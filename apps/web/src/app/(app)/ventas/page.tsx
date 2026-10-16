import Link from 'next/link';
import { ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_VENTA } from '@terranova/shared';
import { api } from '@/lib/api';
import type { Pagina, ProyectoResumen, VentaCuenta } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, CeldaDoble, Fila, Money, Progreso, TONO_CARTERA, TONO_ESTADO_VENTA,
  Tabla, Td, Th, Vacio,
} from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { FiltrosVentas } from './filtros';

export default async function PaginaVentas({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;

  const [proyectos, ventas] = await Promise.all([
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<Pagina<VentaCuenta>>('/ventas', {
      proyectoId: q.proyectoId,
      estadoCartera: q.estadoCartera,
      buscar: q.buscar,
      pagina: q.pagina ?? 1,
      porPagina: 50,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Ventas"
        descripcion={`${ventas.total} venta(s). El saldo se calcula a partir de los pagos vigentes; nunca se almacena.`}
      />

      <Card>
        <div className="border-b border-muted-200/70 p-4">
          <FiltrosVentas proyectos={proyectos} valores={q} />
        </div>

        {ventas.datos.length === 0 ? (
          <Vacio
            titulo="Ninguna venta coincide"
            descripcion="Ajuste los filtros o registre una venta desde un lote disponible."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Fecha</Th>
                <Th>Lote</Th>
                <Th>Cliente</Th>
                <Th alinear="right">Precio</Th>
                <Th alinear="right">Pagado</Th>
                <Th alinear="right">Saldo</Th>
                <Th alinear="center">Cartera</Th>
              </tr>
            </thead>
            <tbody>
              {ventas.datos.map((v) => (
                <Fila key={v.venta_id}>
                  <Td>
                    <Link
                      href={`/ventas/${v.venta_id}`}
                      className="transicion-suave tabular font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                    >
                      #{v.venta_numero}
                    </Link>
                  </Td>
                  <Td className="tabular whitespace-nowrap text-muted-600">
                    {fechaCorta(v.fecha_venta)}
                  </Td>
                  <Td>
                    <CeldaDoble principal={v.lote_codigo} secundario={v.proyecto_nombre} mono />
                  </Td>
                  <Td className="max-w-[14rem]">
                    <CeldaDoble principal={v.cliente_nombre} secundario={v.cliente_documento} />
                  </Td>
                  <Td alinear="right">
                    <Money valor={v.precio_negociado} className="font-medium" />
                  </Td>
                  <Td alinear="right" className="min-w-[8rem]">
                    <Money valor={v.total_pagado} tono="exito" className="font-medium" />
                    <span className="mt-1.5 block">
                      <Progreso
                        porcentaje={Number(v.porcentaje_pagado)}
                        tono={TONO_CARTERA[v.estado_cartera] ?? 'marca'}
                      />
                    </span>
                    <span className="tabular mt-1 block text-2xs text-muted-400">
                      {Number(v.porcentaje_pagado).toFixed(0)}% pagado
                    </span>
                  </Td>
                  <Td alinear="right">
                    <Money
                      valor={v.saldo}
                      tono={Number(v.saldo) > 0 ? 'alerta' : 'tenue'}
                      className="font-medium"
                    />
                  </Td>
                  <Td alinear="center">
                    {v.estado_venta === 'ANULADA' ? (
                      <Badge tono={TONO_ESTADO_VENTA.ANULADA} punto>
                        {ETIQUETA_ESTADO_VENTA.ANULADA}
                      </Badge>
                    ) : (
                      <>
                        <Badge tono={TONO_CARTERA[v.estado_cartera] ?? 'neutro'} punto>
                          {ETIQUETA_ESTADO_CARTERA[v.estado_cartera as 'PAGADO'] ?? v.estado_cartera}
                        </Badge>
                        {v.dias_mora_maximo != null && v.dias_mora_maximo > 0 && (
                          <span className="tabular mt-1 block text-2xs text-danger-500">
                            {v.dias_mora_maximo} días
                          </span>
                        )}
                      </>
                    )}
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  );
}
