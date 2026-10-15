import Link from 'next/link';
import { api } from '@/lib/api';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CardEncabezado, Indicador, Money, Tabla, Td, Th, TONO_CARTERA, Vacio } from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { ETIQUETA_ESTADO_CARTERA, ETIQUETA_TIPO_DOCUMENTO } from '@terranova/shared';

interface Detalle {
  id: string; documento: string; tipoDocumento: string; nombre: string;
  telefono: string; email: string | null; direccion: string | null; ciudad: string | null;
  activo: boolean;
  cartera: Array<{
    venta_id: string; venta_numero: number; proyecto_nombre: string; lote_codigo: string;
    precio_negociado: string; total_pagado: string; saldo: string;
    estado_cartera: string; total_en_mora: string;
  }>;
  totales: { comprado: string; pagado: string; saldo: string; en_mora: string };
}

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await api.get<Detalle>(`/clientes/${id}`);

  return (
    <>
      <EncabezadoPagina
        titulo={c.nombre}
        descripcion={`${ETIQUETA_TIPO_DOCUMENTO[c.tipoDocumento as 'CC'] ?? c.tipoDocumento} ${c.documento}`}
        acciones={
          <Link href="/clientes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Clientes
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Total comprado" valor={fmt(c.totales.comprado)} tono="marca" />
        <Indicador etiqueta="Pagado" valor={fmt(c.totales.pagado)} tono="exito" />
        <Indicador etiqueta="Saldo" valor={fmt(c.totales.saldo)} tono="alerta" />
        <Indicador
          etiqueta="En mora"
          valor={fmt(c.totales.en_mora)}
          tono={Number(c.totales.en_mora) > 0 ? 'peligro' : 'neutro'}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardEncabezado titulo="Datos de contacto" />
          <dl className="space-y-3 p-5 text-sm">
            <Dato etiqueta="Teléfono" valor={c.telefono} />
            <Dato etiqueta="Correo" valor={c.email} />
            <Dato etiqueta="Dirección" valor={c.direccion} />
            <Dato etiqueta="Ciudad" valor={c.ciudad} />
            <div>
              <dt className="text-xs text-muted-500">Estado</dt>
              <dd className="mt-1">
                <Badge tono={c.activo ? 'exito' : 'neutro'}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardEncabezado
            titulo="Cartera consolidada"
            descripcion="Todas sus compras, en todos los proyectos"
          />
          {c.cartera.length === 0 ? (
            <Vacio titulo="Sin compras registradas" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Venta</Th>
                  <Th>Proyecto / lote</Th>
                  <Th alinear="right">Precio</Th>
                  <Th alinear="right">Pagado</Th>
                  <Th alinear="right">Saldo</Th>
                  <Th alinear="center">Estado</Th>
                </tr>
              </thead>
              <tbody>
                {c.cartera.map((v) => (
                  <tr key={v.venta_id} className="hover:bg-muted-100">
                    <Td className="tabular">#{v.venta_numero}</Td>
                    <Td>
                      <span className="font-medium text-ink-900">{v.lote_codigo}</span>
                      <span className="block max-w-[9rem] truncate text-xs text-muted-500">{v.proyecto_nombre}</span>
                    </Td>
                    <Td alinear="right"><Money valor={v.precio_negociado} /></Td>
                    <Td alinear="right"><Money valor={v.total_pagado} tono="exito" /></Td>
                    <Td alinear="right"><Money valor={v.saldo} /></Td>
                    <Td alinear="center">
                      <Badge tono={TONO_CARTERA[v.estado_cartera] ?? 'neutro'}>
                        {ETIQUETA_ESTADO_CARTERA[v.estado_cartera as 'PAGADO'] ?? v.estado_cartera}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Card>
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-ink-900">{valor ?? '—'}</dd>
    </div>
  );
}

const fmt = (v: string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
  }).format(Number(v));
