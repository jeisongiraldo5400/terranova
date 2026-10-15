import Link from 'next/link';
import { api } from '@/lib/api';
import type { Pagina, ProyectoResumen, VentaCuenta } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, Money, Progreso, Tabla, Td, Th, TONO_CARTERA, TONO_ESTADO_VENTA, Vacio,
} from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_VENTA } from '@terranova/shared';
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
        descripcion={`${ventas.total} venta(s). El saldo se calcula a partir de los pagos vigentes, nunca se almacena.`}
      />

      <Card>
        <div className="border-b border-muted-200 p-4">
          <FiltrosVentas proyectos={proyectos} valores={q} />
        </div>

        {ventas.datos.length === 0 ? (
          <Vacio
            titulo="Ninguna venta coincide"
            descripcion="Registre una venta desde el módulo de lotes disponibles."
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
                <Th />
              </tr>
            </thead>
            <tbody>
              {ventas.datos.map((v) => (
                <tr key={v.venta_id} className="hover:bg-muted-100">
                  <Td className="tabular font-medium">#{v.venta_numero}</Td>
                  <Td className="tabular whitespace-nowrap text-muted-600">
                    {fechaCorta(v.fecha_venta)}
                  </Td>
                  <Td>
                    <span className="font-mono font-medium text-ink-900">{v.lote_codigo}</span>
                    <span className="block max-w-[9rem] truncate text-xs text-muted-500">{v.proyecto_nombre}</span>
                  </Td>
                  <Td className="max-w-[13rem]">
                    <span className="block truncate text-ink-900">{v.cliente_nombre}</span>
                    <span className="tabular block text-xs text-muted-500">
                      {v.cliente_documento}
                    </span>
                  </Td>
                  <Td alinear="right"><Money valor={v.precio_negociado} /></Td>
                  <Td alinear="right" className="min-w-[7.5rem]">
                    <Money valor={v.total_pagado} tono="exito" />
                    <span className="mt-1 block">
                      <Progreso
                        porcentaje={Number(v.porcentaje_pagado)}
                        tono={TONO_CARTERA[v.estado_cartera] ?? 'marca'}
                      />
                    </span>
                    <span className="tabular mt-0.5 block text-[10px] text-muted-500">
                      {Number(v.porcentaje_pagado).toFixed(0)}% pagado
                    </span>
                  </Td>
                  <Td alinear="right">
                    <Money valor={v.saldo} tono={Number(v.saldo) > 0 ? 'alerta' : undefined} />
                  </Td>
                  <Td alinear="center">
                    {v.estado_venta === 'ANULADA' ? (
                      <Badge tono={TONO_ESTADO_VENTA.ANULADA}>
                        {ETIQUETA_ESTADO_VENTA.ANULADA}
                      </Badge>
                    ) : (
                      <>
                        <Badge tono={TONO_CARTERA[v.estado_cartera] ?? 'neutro'}>
                          {ETIQUETA_ESTADO_CARTERA[v.estado_cartera as 'PAGADO'] ?? v.estado_cartera}
                        </Badge>
                        {v.dias_mora_maximo != null && v.dias_mora_maximo > 0 && (
                          <span className="tabular mt-1 block text-[10px] text-danger-600">
                            {v.dias_mora_maximo} días
                          </span>
                        )}
                      </>
                    )}
                  </Td>
                  <Td alinear="right">
                    <Link
                      href={`/ventas/${v.venta_id}`}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Ver
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  );
}
