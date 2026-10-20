import {
  ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_VENTA, ETIQUETA_METODO_PAGO,
  ETIQUETA_TIPO_PAGO, Permiso, tienePermiso,
} from '@terranova/shared';
import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Aviso, Badge, Card, CardEncabezado, Fila, Indicador, Money, Progreso,
  TONO_CARTERA, TONO_ESTADO_VENTA, Tabla, Td, Th, Vacio, montoCompacto,
} from '@/components/ui';
import { IconoDinero, IconoMora, IconoPorCobrar, IconoRecaudo } from '@/components/iconos';
import { area, fechaCorta, fechaLarga } from '@/lib/formato';
import { AccionesVenta, BotonAnularPago } from './acciones';

export default async function DetalleVenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [usuario, v] = await Promise.all([exigirSesion(), api.get<any>(`/ventas/${id}`)]);

  const puedePagar = tienePermiso(usuario.rol, Permiso.PAGO_CREAR);
  const puedeContrato = tienePermiso(usuario.rol, Permiso.CONTRATO_GENERAR);
  const puedeAnularVenta = tienePermiso(usuario.rol, Permiso.VENTA_ANULAR);
  const puedeAnularPago = tienePermiso(usuario.rol, Permiso.PAGO_ANULAR);
  const verPagos = tienePermiso(usuario.rol, Permiso.PAGO_VER);
  const anulada = v.estado === 'ANULADA';

  return (
    <>
      <EncabezadoPagina
        titulo={`Venta #${v.numero}`}
        descripcion={`${v.lote.codigo} · ${v.lote.proyecto.nombre} · ${fechaLarga(v.fechaVenta)}`}
        volver={{ href: '/ventas', etiqueta: 'Ventas' }}
      />

      {anulada && (
        <div className="mb-4">
          <Aviso tono="peligro" titulo="Venta anulada">
            {v.motivoAnulacion}
            {v.anuladoPor && (
              <span className="mt-0.5 block text-xs opacity-80">Anulada por {v.anuladoPor.nombre}</span>
            )}
          </Aviso>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          etiqueta="Precio negociado"
          valor={montoCompacto(v.cuenta.precio_negociado)}
          tono="marca"
          icono={<IconoDinero className="size-5" />}
        />
        <Indicador
          etiqueta="Pagado"
          valor={montoCompacto(v.cuenta.total_pagado)}
          detalle={`${Number(v.cuenta.porcentaje_pagado).toFixed(1)}% del precio`}
          tono="exito"
          icono={<IconoRecaudo className="size-5" />}
        />
        <Indicador
          etiqueta="Saldo"
          valor={montoCompacto(v.cuenta.saldo)}
          tono={Number(v.cuenta.saldo) > 0 ? 'alerta' : 'exito'}
          icono={<IconoPorCobrar className="size-5" />}
        />
        <Indicador
          etiqueta="En mora"
          valor={montoCompacto(v.cuenta.total_en_mora)}
          detalle={v.cuenta.dias_mora_maximo ? `${v.cuenta.dias_mora_maximo} días vencida` : 'Al día'}
          tono={Number(v.cuenta.total_en_mora) > 0 ? 'peligro' : 'neutro'}
          icono={<IconoMora className="size-5" />}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* --- Resumen --- */}
        <Card className="lg:col-span-1">
          <CardEncabezado titulo="Resumen" />
          <div className="p-5">
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge tono={TONO_ESTADO_VENTA[v.estado] ?? 'neutro'} punto>
                {ETIQUETA_ESTADO_VENTA[v.estado as 'ACTIVA']}
              </Badge>
              {!anulada && (
                <Badge tono={TONO_CARTERA[v.cuenta.estado_cartera] ?? 'neutro'} punto>
                  {ETIQUETA_ESTADO_CARTERA[v.cuenta.estado_cartera as 'PAGADO']}
                </Badge>
              )}
            </div>

            <dl className="space-y-3.5 text-sm">
              <Dato etiqueta="Comprador" valor={v.cliente.nombre} />
              <Dato etiqueta="Documento" valor={v.cliente.documento} mono />
              <Dato etiqueta="Teléfono" valor={v.cliente.telefono} mono />
              <Dato etiqueta="Lote" valor={`${v.lote.codigo} · ${area(v.lote.areaM2)}`} />
              <Dato etiqueta="Etapa" valor={v.lote.etapa?.nombre ?? '—'} />
              <Dato etiqueta="Registró" valor={v.registradoPor?.nombre ?? '—'} />
            </dl>

            <div className="mt-5 border-t border-muted-200 pt-4">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-500">Avance de pago</span>
                <span className="tabular font-medium text-ink-800">
                  {Number(v.cuenta.porcentaje_pagado).toFixed(1)}%
                </span>
              </div>
              <Progreso
                porcentaje={Number(v.cuenta.porcentaje_pagado)}
                tono={TONO_CARTERA[v.cuenta.estado_cartera] ?? 'marca'}
              />
            </div>
          </div>
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
                  <Fila key={c.cuota_id}>
                    <Td className="tabular text-muted-500">{c.numero}</Td>
                    <Td className="font-medium text-ink-900">{c.descripcion}</Td>
                    <Td className="tabular whitespace-nowrap text-muted-600">
                      {fechaCorta(c.fecha_vencimiento)}
                    </Td>
                    <Td alinear="right"><Money valor={c.monto_esperado} /></Td>
                    <Td alinear="right">
                      <Money
                        valor={c.monto_cubierto}
                        tono={Number(c.monto_cubierto) > 0 ? 'exito' : 'tenue'}
                      />
                    </Td>
                    <Td alinear="center">
                      <Badge
                        punto
                        tono={
                          c.estado === 'PAGADA' ? 'exito'
                          : c.estado === 'EN_MORA' ? 'peligro'
                          : c.estado === 'PARCIAL' ? 'marca' : 'neutro'
                        }
                      >
                        {c.estado === 'PAGADA' ? 'Pagada'
                          : c.estado === 'EN_MORA' ? `Vencida ${c.dias_vencida}d`
                          : c.estado === 'PARCIAL' ? 'Parcial' : 'Pendiente'}
                      </Badge>
                    </Td>
                  </Fila>
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
                    estadoVenta={v.estado}
                    pagosVigentes={v.pagos.filter((p: any) => !p.anulado).length}
                    puedePagar={puedePagar && !anulada}
                    puedeContrato={puedeContrato && !anulada}
                    puedeAnular={puedeAnularVenta}
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
                      {puedeAnularPago && <Th alinear="right">Acciones</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {v.pagos.map((p: any) => (
                      <Fila key={p.id} className={p.anulado ? 'opacity-55' : ''}>
                        <Td className="tabular whitespace-nowrap text-muted-600">
                          {fechaCorta(p.fecha)}
                        </Td>
                        <Td className="font-medium text-ink-900">
                          {ETIQUETA_TIPO_PAGO[p.tipo as 'ABONO']}
                        </Td>
                        <Td className="text-muted-500">
                          {ETIQUETA_METODO_PAGO[p.metodo as 'EFECTIVO']}
                        </Td>
                        <Td className="font-mono text-2xs text-muted-500">{p.referencia ?? '—'}</Td>
                        <Td alinear="right">
                          <Money
                            valor={p.monto}
                            className={`font-medium ${p.anulado ? 'line-through' : ''}`}
                            tono={p.anulado ? 'tenue' : 'exito'}
                          />
                        </Td>
                        <Td alinear="center">
                          {p.anulado ? (
                            <Badge tono="peligro" punto title={p.motivoAnulacion ?? ''}>
                              Anulado
                            </Badge>
                          ) : (
                            <Badge tono="exito" punto>Vigente</Badge>
                          )}
                        </Td>
                        {puedeAnularPago && (
                          <Td alinear="right">
                            {!p.anulado && !anulada && (
                              <BotonAnularPago pagoId={p.id} monto={p.monto} />
                            )}
                          </Td>
                        )}
                      </Fila>
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

function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-500">{etiqueta}</dt>
      <dd className={`min-w-0 truncate text-right text-ink-900 ${mono ? 'tabular font-mono text-xs' : ''}`}>
        {valor}
      </dd>
    </div>
  );
}
