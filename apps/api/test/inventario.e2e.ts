/* ==========================================================================
   Pruebas de integracion: proyectos, lotes y clientes
   --------------------------------------------------------------------------
   Las reglas de estos modulos estaban cubiertas solo de forma indirecta.
   Aqui se ejercitan contra PostgreSQL de verdad, donde viven los triggers
   y los indices unicos que las respaldan.
   ========================================================================== */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { arrancarApp, cookieDe, crearEscenario, crearUsuarios, dec, limpiar } from './apoyo.js';
import type { PrismaService } from '../src/common/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let cookie: string;
let escenario: Awaited<ReturnType<typeof crearEscenario>>;

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
});

describe('lotes', () => {
  const loteBase = () => ({
    proyectoId: escenario.proyecto.id,
    codigo: 'NUEVO-01',
    areaM2: 1500,
    precioLista: '100000000',
  });

  it('crea un lote válido', async () => {
    const res = await api()
      .post('/api/lotes')
      .set('Cookie', cookie)
      .send(loteBase())
      .expect(201);

    expect(res.body.codigo).toBe('NUEVO-01');
    expect(res.body.areaM2).toBe('1500.00');
    expect(res.body.estado).toBe('DISPONIBLE');
  });

  /* La regla del documento original, que el v0 no podia aplicar porque el
     formulario de lotes no tenia campo de area. */
  it('rechaza un lote por debajo del área mínima', async () => {
    const res = await api()
      .post('/api/lotes')
      .set('Cookie', cookie)
      .send({ ...loteBase(), areaM2: 500 })
      .expect(400);

    expect(res.body.errores.areaM2).toMatch(/1000 m2/);
  });

  it('rechaza un código duplicado en el mismo proyecto', async () => {
    await api().post('/api/lotes').set('Cookie', cookie).send(loteBase()).expect(201);

    const res = await api()
      .post('/api/lotes')
      .set('Cookie', cookie)
      .send(loteBase())
      .expect(409);

    expect(res.body.mensaje).toMatch(/ya existe un lote con ese código/i);
  });

  it('normaliza el código a mayúsculas sin espacios', async () => {
    const res = await api()
      .post('/api/lotes')
      .set('Cookie', cookie)
      .send({ ...loteBase(), codigo: 'mz-b 07' })
      .expect(201);

    expect(res.body.codigo).toBe('MZ-B07');
  });

  it('crea una manzana completa y omite los duplicados', async () => {
    const primera = await api()
      .post('/api/lotes/en-lote')
      .set('Cookie', cookie)
      .send({
        proyectoId: escenario.proyecto.id,
        prefijo: 'MZ-C',
        desde: 1,
        hasta: 5,
        areaM2: 1100,
        precioLista: '80000000',
      })
      .expect(201);

    expect(primera.body).toEqual({ creados: 5, omitidos: 0 });

    // Repetir el rango no duplica: los existentes se omiten.
    const segunda = await api()
      .post('/api/lotes/en-lote')
      .set('Cookie', cookie)
      .send({
        proyectoId: escenario.proyecto.id,
        prefijo: 'MZ-C',
        desde: 1,
        hasta: 8,
        areaM2: 1100,
        precioLista: '80000000',
      })
      .expect(201);

    expect(segunda.body).toEqual({ creados: 3, omitidos: 5 });
  });

  it('impide editar un lote con venta vigente', async () => {
    await api()
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

    const res = await api()
      .patch(`/api/lotes/${escenario.lotes[0]!.id}`)
      .set('Cookie', cookie)
      .send({ precioLista: '120000000' })
      .expect(422);

    expect(res.body.mensaje).toMatch(/no se puede modificar/i);
  });

  it('no deja marcar un lote como VENDIDO a mano', async () => {
    const res = await api()
      .patch(`/api/lotes/${escenario.lotes[0]!.id}`)
      .set('Cookie', cookie)
      .send({ estado: 'VENDIDO' })
      .expect(422);

    expect(res.body.mensaje).toMatch(/registre la venta/i);
  });
});

describe('clientes', () => {
  it('normaliza el documento para detectar duplicados', async () => {
    const res = await api()
      .post('/api/clientes')
      .set('Cookie', cookie)
      .send({ documento: '1.234.567', nombre: 'Prueba Uno', telefono: '3001112233' })
      .expect(201);

    expect(res.body.documento).toBe('1234567');

    // El mismo documento con otra puntuación es la misma persona.
    const duplicado = await api()
      .post('/api/clientes')
      .set('Cookie', cookie)
      .send({ documento: '1-234-567', nombre: 'Prueba Dos', telefono: '3004445566' })
      .expect(409);

    expect(duplicado.body.mensaje).toMatch(/ya existe un cliente registrado con ese documento/i);
  });

  it('no elimina un cliente con ventas vigentes', async () => {
    await api()
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

    const res = await api()
      .delete(`/api/clientes/${escenario.cliente.id}`)
      .set('Cookie', cookie)
      .expect(422);

    expect(res.body.mensaje).toMatch(/venta\(s\) vigente/i);
  });

  it('desactiva en lugar de eliminar, y el cliente desactivado no compra', async () => {
    await api()
      .post(`/api/clientes/${escenario.cliente.id}/desactivar`)
      .set('Cookie', cookie)
      .expect(201);

    const res = await api()
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
      .expect(422);

    expect(res.body.mensaje).toMatch(/desactivado/i);
  });

  it('busca sin distinguir acentos ni mayúsculas', async () => {
    await prisma.cliente.create({
      data: { documento: '9998887', nombre: 'José Peréz Gómez', telefono: '3001112233' },
    });

    const res = await api()
      .get('/api/clientes')
      .query({ buscar: 'jose perez' })
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.datos.some((c: any) => c.documento === '9998887')).toBe(true);
  });
});

describe('proyectos', () => {
  it('impide subir el área mínima si deja lotes en infracción', async () => {
    const res = await api()
      .patch(`/api/proyectos/${escenario.proyecto.id}`)
      .set('Cookie', cookie)
      .send({ areaMinimaM2: 5000 })
      .expect(422);

    expect(res.body.mensaje).toMatch(/quedarian por debajo/i);
  });

  it('no elimina un proyecto con lotes comprometidos', async () => {
    await prisma.lote.update({
      where: { id: escenario.lotes[0]!.id },
      data: { estado: 'RESERVADO' },
    });

    const res = await api()
      .delete(`/api/proyectos/${escenario.proyecto.id}`)
      .set('Cookie', cookie)
      .expect(422);

    expect(res.body.mensaje).toMatch(/lote\(s\) con compromiso/i);
  });

  it('expone el resumen de inventario y cartera', async () => {
    const res = await api().get('/api/proyectos').set('Cookie', cookie).expect(200);

    const p = res.body.find((x: any) => x.proyecto_id === escenario.proyecto.id);
    expect(p.total_lotes).toBe(3);
    expect(p.lotes_disponibles).toBe(3);
  });

  it('crea etapas numeradas sin repetir', async () => {
    await api()
      .post('/api/proyectos/etapas')
      .set('Cookie', cookie)
      .send({ proyectoId: escenario.proyecto.id, numero: 1, nombre: 'Etapa I' })
      .expect(201);

    await api()
      .post('/api/proyectos/etapas')
      .set('Cookie', cookie)
      .send({ proyectoId: escenario.proyecto.id, numero: 1, nombre: 'Repetida' })
      .expect(409)
      .expect((r) => expect(r.body.mensaje).toMatch(/etapa con ese número/i));
  });
});

describe('área mínima configurada por proyecto', () => {
  it('respeta el mínimo del proyecto, no solo el global', async () => {
    const especial = await prisma.proyecto.create({
      data: { codigo: 'P2', nombre: 'Con mínimo alto', areaMinimaM2: dec('2000') },
    });

    // 1500 supera el mínimo global de 1000 pero no el del proyecto.
    const res = await api()
      .post('/api/lotes')
      .set('Cookie', cookie)
      .send({
        proyectoId: especial.id,
        codigo: 'ESP-01',
        areaM2: 1500,
        precioLista: '100000000',
      })
      .expect(422);

    expect(res.body.mensaje).toMatch(/2000/);
  });
});
