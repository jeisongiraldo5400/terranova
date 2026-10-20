import { api } from '@/lib/api';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CardEncabezado, Fila, Indicador, Money, Tabla, Td, Th, TONO_CARTERA, Vacio, montoCompacto } from '@/components/ui';
import { IconoDinero, IconoMora, IconoPorCobrar, IconoRecaudo } from '@/components/iconos';
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
        volver={{ href: '/clientes', etiqueta: 'Clientes' }}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Total comprado" valor={montoCompacto(c.totales.comprado)} tono="marca" icono={<IconoDinero className="size-5" />} />
        <Indicador etiqueta="Pagado" valor={montoCompacto(c.totales.pagado)} tono="exito" icono={<IconoRecaudo className="size-5" />} />
        <Indicador etiqueta="Saldo" valor={montoCompacto(c.totales.saldo)} tono="alerta" icono={<IconoPorCobrar className="size-5" />} />
        <Indicador
          etiqueta="En mora"
          valor={montoCompacto(c.totales.en_mora)}
          tono={Number(c.totales.en_mora) > 0 ? 'peligro' : 'neutro'}
          icono={<IconoMora className="size-5" />}
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
                <Badge tono={c.activo ? 'exito' : 'neutro'} punto>
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
                  <Fila key={v.venta_id}>
                    <Td className="tabular">#{v.venta_numero}</Td>
                    <Td>
                      <span className="font-medium text-ink-900">{v.lote_codigo}</span>
                      <span className="block max-w-[9rem] truncate text-xs text-muted-500">{v.proyecto_nombre}</span>
                    </Td>
                    <Td alinear="right"><Money valor={v.precio_negociado} /></Td>
                    <Td alinear="right"><Money valor={v.total_pagado} tono="exito" /></Td>
                    <Td alinear="right"><Money valor={v.saldo} /></Td>
                    <Td alinear="center">
                      <Badge tono={TONO_CARTERA[v.estado_cartera] ?? 'neutro'} punto>
                        {ETIQUETA_ESTADO_CARTERA[v.estado_cartera as 'PAGADO'] ?? v.estado_cartera}
                      </Badge>
                    </Td>
                  </Fila>
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

