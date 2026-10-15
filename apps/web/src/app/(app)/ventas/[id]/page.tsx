import Link from 'next/link';
import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Aviso, Badge, Card, CardEncabezado, Indicador, Money, Progreso,
  Tabla, Td, Th, TONO_CARTERA, TONO_ESTADO_VENTA, Vacio,
} from '@/components/ui';
import { area, fechaCorta, fechaLarga } from '@/lib/formato';
import {
  ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_VENTA, ETIQUETA_METODO_PAGO,
  ETIQUETA_TIPO_PAGO, Permiso, tienePermiso,
} from '@terranova/shared';
import { AccionesVenta } from './acciones';

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [usuario, v] = await Promise.all([exigirSesion(), api.get<any>(`/ventas/${id}`)]);

  const puedePagar = tienePermiso(usuario.rol, Permiso.PAGO_CREAR);
  const puedeAnular = tienePermiso(usuario.rol, Permiso.PAGO_ANULAR);
  const puedeContrato = tienePermiso(usuario.rol, Permiso.CONTRATO_GENERAR);
  const verPagos = tienePermiso(usuario.rol, Permiso.PAGO_VER);

  const anulada = v.estado === 'ANULADA';

  return (
    <>
      <EncabezadoPagina
        titulo={`Venta #${v.numero}`}
        descripcion={`${v.lote.codigo} · ${v.lote.proyecto.nombre} · ${fechaLarga(v.fechaVenta)}`}
        acciones={
          <Link href="/ventas" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Ventas
          </Link>
        }
      />

      {anulada && (
        <div className="mb-4">
          <Aviso tono="peligro" titulo="Venta anulada">
            {v.motivoAnulacion}
            {v.anuladoPor && <span className="block text-xs opacity-80">Por {v.anuladoPor.nombre}</span>}
          </Aviso>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Precio negociado" valor={fmt(v.cuenta.precio_negociado)} tono="marca" />
        <Indicador etiqueta="Pagado" valor={fmt(v.cuenta.total_pagado)} tono="exito" />
        <Indicador etiqueta="Saldo" valor={fmt(v.cuenta.saldo)} tono={Number(v.cuenta.saldo) > 0 ? 'alerta' : 'exito'} />
        <Indicador
          etiqueta="En mora"
          valor={fmt(v.cuenta.total_en_mora)}
          detalle={v.cuenta.dias_mora_maximo ? `${v.cuenta.dias_mora_maximo} días` : undefined}
          tono={Number(v.cuenta.total_en_mora) > 0 ? 'peligro' : 'neutro'}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardEncabezado titulo="Resumen" />
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-xs text-muted-500">Estado</dt>
              <dd className="mt-1 flex gap-2">
                <Badge tono={TONO_ESTADO_VENTA[v.estado] ?? 'neutro'}>
                  {ETIQUETA_ESTADO_VENTA[v.estado as 'ACTIVA']}
                </Badge>
                {!anulada && (
                  <Badge tono={TONO_CARTERA[v.cuenta.estado_cartera] ?? 'neutro'}>
                    {ETIQUETA_ESTADO_CARTERA[v.cuenta.estado_cartera as 'PAGADO']}
                  </Badge>
                )}
              </dd>
            </div>
            <Dato etiqueta="Comprador" valor={v.cliente.nombre} />
            <Dato etiqueta="Documento" valor={v.cliente.documento} />
            <Dato etiqueta="Teléfono" valor={v.cliente.telefono} />
            <Dato etiqueta="Lote" valor={`${v.lote.codigo} · ${area(v.lote.areaM2)}`} />
            <Dato etiqueta="Etapa" valor={v.lote.etapa?.nombre ?? '—'} />
            <Dato etiqueta="Registró" valor={v.registradoPor?.nombre ?? '—'} />
            <div>
              <dt className="text-xs text-muted-500">Avance</dt>
              <dd className="mt-1.5">
                <Progreso
                  porcentaje={Number(v.cuenta.porcentaje_pagado)}
                  tono={TONO_CARTERA[v.cuenta.estado_cartera] ?? 'marca'}
                />
                <span className="tabular mt-1 block text-xs text-muted-500">
                  {Number(v.cuenta.porcentaje_pagado).toFixed(1)}% pagado
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {/* --- Plan de pago --- */}
          <Card>
            <CardEncabezado
              titulo="Plan de pago"
              descripcion={`${v.plan?.numeroCuotas ?? 0} cuota(s). Suman exactamente el precio negociado.`}
            />
            <Tabla>
              <thead>
                <tr>
                  <Th>No.</Th>
                  <Th>Concepto</Th>
                  <Th>Vence</Th>
                  <Th alinear="right">Esperado</Th>
                  <Th alinear="right">Cubierto</Th>
                  <Th alinear="center">Estado</Th>
                </tr>
              </thead>
              <tbody>
                {v.cuotasEstado.map((c: any) => (
                  <tr key={c.cuota_id} className="hover:bg-muted-100">
                    <Td className="tabular">{c.numero}</Td>
                    <Td className="text-ink-900">{c.descripcion}</Td>
                    <Td className="tabular whitespace-nowrap text-muted-600">
                      {fechaCorta(c.fecha_vencimiento)}
                    </Td>
                    <Td alinear="right"><Money valor={c.monto_esperado} /></Td>
                    <Td alinear="right"><Money valor={c.monto_cubierto} tono="exito" /></Td>
                    <Td alinear="center">
                      <Badge
                        tono={
                          c.estado === 'PAGADA' ? 'exito'
                          : c.estado === 'EN_MORA' ? 'peligro'
                          : c.estado === 'PARCIAL' ? 'marca' : 'neutro'
                        }
                      >
                        {c.estado === 'PAGADA' ? 'Pagada'
                          : c.estado === 'EN_MORA' ? `Vencida (${c.dias_vencida}d)`
                          : c.estado === 'PARCIAL' ? 'Parcial' : 'Pendiente'}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </Card>

          {/* --- Pagos --- */}
          {verPagos && (
            <Card>
              <CardEncabezado
                titulo="Pagos"
                descripcion="Los pagos anulados permanecen con su motivo; nunca se borran."
                accion={
                  <AccionesVenta
                    ventaId={v.id}
                    saldo={v.cuenta.saldo}
                    puedePagar={puedePagar && !anulada}
                    puedeAnular={puedeAnular}
                    puedeContrato={puedeContrato && !anulada}
                    contratos={v.contratos}
                  />
                }
              />
              {v.pagos.length === 0 ? (
                <Vacio
                  titulo="Sin pagos registrados"
                  descripcion="Registre la cuota inicial para empezar a abonar."
                />
              ) : (
                <Tabla>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Tipo</Th>
                      <Th>Método</Th>
                      <Th>Referencia</Th>
                      <Th alinear="right">Monto</Th>
                      <Th alinear="center">Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.pagos.map((p: any) => (
                      <tr key={p.id} className={p.anulado ? 'opacity-60' : 'hover:bg-muted-100'}>
                        <Td className="tabular whitespace-nowrap">{fechaCorta(p.fecha)}</Td>
                        <Td>{ETIQUETA_TIPO_PAGO[p.tipo as 'ABONO']}</Td>
                        <Td className="text-muted-600">
                          {ETIQUETA_METODO_PAGO[p.metodo as 'EFECTIVO']}
                        </Td>
                        <Td className="tabular font-mono text-xs text-muted-600">
                          {p.referencia ?? '—'}
                        </Td>
                        <Td alinear="right">
                          <Money
                            valor={p.monto}
                            className={p.anulado ? 'line-through' : ''}
                            tono={p.anulado ? undefined : 'exito'}
                          />
                        </Td>
                        <Td alinear="center">
                          {p.anulado ? (
                            <span title={p.motivoAnulacion ?? ''}>
                              <Badge tono="peligro">Anulado</Badge>
                            </span>
                          ) : (
                            <Badge tono="exito">Vigente</Badge>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-ink-900">{valor}</dd>
    </div>
  );
}

const fmt = (v: string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact',
  }).format(Number(v));
