/* ==========================================================================
   Pruebas de integracion: cartera, liquidacion y anulacion de pagos
   ========================================================================== */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { arrancarApp, cookieDe, crearEscenario, crearUsuarios, limpiar } from './apoyo.js';
import type { PrismaService } from '../src/common/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let cookie: string;
let escenario: Awaited<ReturnType<typeof crearEscenario>>;
let ventaId: string;

const api = () => request(app.getHttpServer());

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

  const login = await api()
    .post('/api/auth/login')
    .send({ email: u.admin.email, password: u.clave })
    .expect(200);
  cookie = cookieDe(login);

  const venta = await api()
    .post('/api/ventas')
    .set('Cookie', cookie)
    .send({
      loteId: escenario.lotes[0]!.id,
      clienteId: escenario.cliente.id,
      precioNegociado: '90000000',
      fechaVenta: '2026-01-15',
      porcentajeInicial: 30,
      modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: '2026-12-15' },
    })
    .expect(201);
  ventaId = venta.body.id;
});

const pagar = (datos: Record<string, unknown>) =>
  api()
    .post('/api/pagos')
    .set('Cookie', cookie)
    .send({ ventaId, metodo: 'TRANSFERENCIA', ...datos });

describe('validacion de pagos', () => {
  it('acepta un pago dentro del saldo', async () => {
    const res = await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201);
    expect(res.body.monto).toBe('27000000.00');
  });

  it('interpreta el formato colombiano del formulario', async () => {
    const res = await pagar({ tipo: 'CUOTA_INICIAL', monto: '27.000.000', fecha: '2026-01-15' }).expect(201);
    expect(res.body.monto).toBe('27000000.00');
  });

  it('rechaza un pago mayor al saldo', async () => {
    const res = await pagar({ tipo: 'ABONO', monto: '200000000', fecha: '2026-02-01' }).expect(422);
    expect(res.body.mensaje).toMatch(/excede el saldo/);
  });

  it('rechaza un pago con fecha futura', async () => {
    const res = await pagar({ tipo: 'ABONO', monto: '1000000', fecha: '2030-01-01' }).expect(400);
    expect(res.body.errores.fecha).toMatch(/futura/i);
  });

  it('rechaza un pago anterior a la venta', async () => {
    const res = await pagar({ tipo: 'ABONO', monto: '1000000', fecha: '2025-06-01' }).expect(422);
    expect(res.body.mensaje).toMatch(/anterior a la fecha de la venta/);
  });

  it('rechaza monto cero', async () => {
    await pagar({ tipo: 'ABONO', monto: '0', fecha: '2026-02-01' }).expect(400);
  });
});

describe('liquidacion automatica', () => {
  /* La regla del documento original: saldo cero => lote PAGADO. En el v0
     dependia de `saldo === 0` sobre un float y fallaba con residuos. */
  it('liquida la venta y el lote cuando el saldo llega a cero', async () => {
    await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201);
    await pagar({ tipo: 'PAGO_FINAL', monto: '63000000', fecha: '2026-06-01' }).expect(201);

    const venta = await prisma.venta.findUniqueOrThrow({
      where: { id: ventaId },
      include: { lote: true },
    });
    expect(venta.estado).toBe('LIQUIDADA');
    expect(venta.lote.estado).toBe('PAGADO');

    const cuenta = await api()
      .get(`/api/pagos/estado-cuenta/${ventaId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(cuenta.body.saldo).toBe('0.00');
    expect(cuenta.body.estado).toBe('PAGADO');
  });

  it('liquida con montos que dejan residuo decimal', async () => {
    // 90.000.000 en tres partes: con floats el saldo nunca llega a cero.
    await pagar({ tipo: 'CUOTA_INICIAL', monto: '30000000.01', fecha: '2026-01-15' }).expect(201);
    await pagar({ tipo: 'ABONO', monto: '29999999.99', fecha: '2026-02-15' }).expect(201);
    await pagar({ tipo: 'PAGO_FINAL', monto: '30000000', fecha: '2026-03-15' }).expect(201);

    const venta = await prisma.venta.findUniqueOrThrow({
      where: { id: ventaId },
      include: { lote: true },
    });
    expect(venta.estado).toBe('LIQUIDADA');
    expect(venta.lote.estado).toBe('PAGADO');
  });

  it('impide pagar sobre una venta ya liquidada', async () => {
    await pagar({ tipo: 'CUOTA_INICIAL', monto: '90000000', fecha: '2026-01-15' }).expect(201);
    const res = await pagar({ tipo: 'ABONO', monto: '1', fecha: '2026-02-01' }).expect(422);
    expect(res.body.mensaje).toMatch(/ya esta totalmente pagada/);
  });
});

describe('anulacion de pagos', () => {
  it('exige motivo y conserva el registro', async () => {
    const pago = (
      await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201)
    ).body;

    await api()
      .post(`/api/pagos/${pago.id}/anular`)
      .set('Cookie', cookie)
      .send({ motivo: 'corto' })
      .expect(400);

    await api()
      .post(`/api/pagos/${pago.id}/anular`)
      .set('Cookie', cookie)
      .send({ motivo: 'Transferencia devuelta por el banco.' })
      .expect(201);

    // El v0 lo borraba del arreglo: aqui sigue, con su rastro.
    const enBase = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(enBase.anulado).toBe(true);
    expect(enBase.anuladoPorId).not.toBeNull();
    expect(enBase.anuladoEn).not.toBeNull();
  });

  /* Regresion: faltaba la transicion PAGADO -> VENDIDO y anular un pago
     de una venta liquidada fallaba. */
  it('reabre una venta liquidada al anular un pago', async () => {
    await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201);
    const final = (
      await pagar({ tipo: 'PAGO_FINAL', monto: '63000000', fecha: '2026-06-01' }).expect(201)
    ).body;

    let venta = await prisma.venta.findUniqueOrThrow({ where: { id: ventaId }, include: { lote: true } });
    expect(venta.estado).toBe('LIQUIDADA');
    expect(venta.lote.estado).toBe('PAGADO');

    await api()
      .post(`/api/pagos/${final.id}/anular`)
      .set('Cookie', cookie)
      .send({ motivo: 'Cheque devuelto por fondos insuficientes.' })
      .expect(201);

    venta = await prisma.venta.findUniqueOrThrow({ where: { id: ventaId }, include: { lote: true } });
    expect(venta.estado).toBe('ACTIVA');
    expect(venta.lote.estado).toBe('VENDIDO');

    const cuenta = await api()
      .get(`/api/pagos/estado-cuenta/${ventaId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(cuenta.body.saldo).toBe('63000000.00');
  });

  it('el pago anulado no cuenta en la cartera', async () => {
    const pago = (
      await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201)
    ).body;

    await api()
      .post(`/api/pagos/${pago.id}/anular`)
      .set('Cookie', cookie)
      .send({ motivo: 'Error de digitacion del cajero.' })
      .expect(201);

    const cuenta = await api()
      .get(`/api/pagos/estado-cuenta/${ventaId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(cuenta.body.totalPagado).toBe('0.00');
    expect(cuenta.body.saldo).toBe('90000000.00');
  });
});

describe('auditoria', () => {
  it('registra quien hizo cada movimiento de dinero', async () => {
    await pagar({ tipo: 'CUOTA_INICIAL', monto: '27000000', fecha: '2026-01-15' }).expect(201);

    const registros = await prisma.auditLog.findMany({
      where: { accion: 'PAGO_REGISTRADO' },
      include: { usuario: true },
    });

    expect(registros).toHaveLength(1);
    expect(registros[0]!.usuario?.email).toBe('admin@t.co');
    expect(registros[0]!.despues).toMatchObject({ monto: '27000000.00' });
  });
});
