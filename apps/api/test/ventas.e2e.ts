/* ==========================================================================
   Pruebas de integracion: el flujo que el v0 tenia roto
   ========================================================================== */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { arrancarApp, cookieDe, crearEscenario, crearUsuarios, limpiar } from './apoyo.js';
import type { PrismaService } from '../src/common/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let cookieAdmin: string;
let cookieSecretaria: string;
let cookieEmpleado: string;
let escenario: Awaited<ReturnType<typeof crearEscenario>>;

const api = () => request(app.getHttpServer());

async function entrar(email: string, clave: string): Promise<string> {
  const res = await api().post('/api/auth/login').send({ email, password: clave }).expect(200);
  return cookieDe(res);
}

beforeAll(async () => {
  ({ app, prisma } = await arrancarApp());
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await limpiar(prisma);
  const u = await crearUsuarios(prisma);
  escenario = await crearEscenario(prisma);
  [cookieAdmin, cookieSecretaria, cookieEmpleado] = await Promise.all([
    entrar(u.admin.email, u.clave),
    entrar(u.secretaria.email, u.clave),
    entrar(u.empleado.email, u.clave),
  ]);
});

const ventaBase = (loteId: string, clienteId: string) => ({
  loteId,
  clienteId,
  precioNegociado: '90000000',
  fechaVenta: '2026-01-15',
  porcentajeInicial: 30,
  modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: '2026-12-15' },
});

describe('autenticacion', () => {
  it('rechaza credenciales incorrectas sin revelar si el correo existe', async () => {
    const inexistente = await api()
      .post('/api/auth/login')
      .send({ email: 'nadie@t.co', password: 'LoQueSea.2026' })
      .expect(401);

    const claveMala = await api()
      .post('/api/auth/login')
      .send({ email: 'admin@t.co', password: 'Incorrecta.2026' })
      .expect(401);

    expect(inexistente.body.mensaje).toBe(claveMala.body.mensaje);
  });

  it('protege las rutas sin sesion', async () => {
    await api().get('/api/ventas').expect(401);
  });
});

describe('permisos por rol', () => {
  it('la secretaria registra ventas pero no las anula', async () => {
    const res = await api()
      .post('/api/ventas')
      .set('Cookie', cookieSecretaria)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
      .expect(201);

    await api()
      .post(`/api/ventas/${res.body.id}/anular`)
      .set('Cookie', cookieSecretaria)
      .send({ motivo: 'Motivo suficientemente largo para pasar' })
      .expect(403);
  });

  it('el empleado no ve pagos ni crea ventas', async () => {
    await api().get('/api/pagos').set('Cookie', cookieEmpleado).expect(403);
    await api()
      .post('/api/ventas')
      .set('Cookie', cookieEmpleado)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
      .expect(403);
    // Pero sí consulta el inventario.
    await api().get('/api/lotes').set('Cookie', cookieEmpleado).expect(200);
  });
});

describe('registrar venta', () => {
  it('crea la venta con su plan y marca el lote como vendido', async () => {
    const res = await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
      .expect(201);

    expect(res.body.precioNegociado).toBe('90000000.00');
    expect(res.body.plan.cuotaInicial).toBe('27000000.00');
    expect(res.body.plan.cuotas).toHaveLength(2);

    // La venta SI queda persistida: es lo que el v0 nunca hacia, y por eso
    // los modulos de pagos y contratos quedaban siempre vacios.
    const enBase = await prisma.venta.findUnique({ where: { id: res.body.id } });
    expect(enBase).not.toBeNull();

    const lote = await prisma.lote.findUniqueOrThrow({ where: { id: escenario.lotes[0]!.id } });
    expect(lote.estado).toBe('VENDIDO');
  });

  it('conserva la fecha sin correrla de zona horaria', async () => {
    const res = await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
      .expect(201);

    expect(res.body.fechaVenta).toBe('2026-01-15');
    expect(res.body.plan.cuotas[0].fechaVencimiento).toBe('2026-01-15');
  });

  it('impide vender dos veces el mismo lote', async () => {
    await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
      .expect(201);

    const segunda = await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.otroCliente.id));

    expect(segunda.status).toBeGreaterThanOrEqual(400);
    // El mensaje debe ser accionable, no un volcado del motor.
    expect(segunda.body.mensaje).toMatch(/venta vigente|no esta disponible/i);
    expect(await prisma.venta.count({ where: { loteId: escenario.lotes[0]!.id } })).toBe(1);
  });

  /* La prueba decisiva: dos peticiones simultaneas sobre el mismo lote.
     En el v0 esto creaba dos ventas, porque la comprobacion era en memoria
     y no habia transaccion ni bloqueo. */
  it('resiste dos ventas concurrentes del mismo lote', async () => {
    const lote = escenario.lotes[1]!.id;

    const resultados = await Promise.allSettled([
      api().post('/api/ventas').set('Cookie', cookieAdmin).send(ventaBase(lote, escenario.cliente.id)),
      api().post('/api/ventas').set('Cookie', cookieAdmin).send(ventaBase(lote, escenario.otroCliente.id)),
    ]);

    const exitosas = resultados.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 201,
    ).length;

    expect(exitosas).toBe(1);
    expect(await prisma.venta.count({ where: { loteId: lote } })).toBe(1);
  });

  it('rechaza una fecha de venta futura', async () => {
    const res = await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send({
        ...ventaBase(escenario.lotes[0]!.id, escenario.cliente.id),
        fechaVenta: '2030-01-01',
      })
      .expect(400);

    expect(res.body.errores.fechaVenta).toMatch(/futura/i);
  });

  it('exige la cuota inicial minima', async () => {
    const res = await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send({
        ...ventaBase(escenario.lotes[0]!.id, escenario.cliente.id),
        porcentajeInicial: 2,
      })
      .expect(422);

    expect(res.body.mensaje).toMatch(/al menos el 10%/);
  });
});

describe('anular venta', () => {
  it('libera el lote y reversa los pagos sin borrarlos', async () => {
    const venta = (
      await api()
        .post('/api/ventas')
        .set('Cookie', cookieAdmin)
        .send(ventaBase(escenario.lotes[0]!.id, escenario.cliente.id))
        .expect(201)
    ).body;

    await api()
      .post('/api/pagos')
      .set('Cookie', cookieAdmin)
      .send({
        ventaId: venta.id,
        tipo: 'CUOTA_INICIAL',
        monto: '27000000',
        fecha: '2026-01-15',
        metodo: 'EFECTIVO',
      })
      .expect(201);

    await api()
      .post(`/api/ventas/${venta.id}/anular`)
      .set('Cookie', cookieAdmin)
      .send({ motivo: 'El comprador se retracto dentro del plazo legal.', anularPagos: true })
      .expect(201);

    const lote = await prisma.lote.findUniqueOrThrow({ where: { id: escenario.lotes[0]!.id } });
    expect(lote.estado).toBe('DISPONIBLE');

    const pagos = await prisma.pago.findMany({ where: { ventaId: venta.id } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0]!.anulado).toBe(true);
    expect(pagos[0]!.motivoAnulacion).toContain('se retracto');

    // El lote liberado se puede volver a vender.
    await api()
      .post('/api/ventas')
      .set('Cookie', cookieAdmin)
      .send(ventaBase(escenario.lotes[0]!.id, escenario.otroCliente.id))
      .expect(201);
  });
});
