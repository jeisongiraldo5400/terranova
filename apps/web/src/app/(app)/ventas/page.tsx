import Link from 'next/link';
import { ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_VENTA, Permiso, tienePermiso } from '@terranova/shared';
import { api } from '@/lib/api';
import type { Cliente, Lote, Pagina, ProyectoResumen, VentaCuenta } from '@/lib/tipos';
import { exigirSesion } from '@/lib/sesion';
import { Paginacion } from '@/components/paginacion';
import { BotonRegistrarVenta } from './registrar';
import { AccionesFilaVenta } from './acciones-fila';
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

  const [usuario, proyectos, ventas] = await Promise.all([
    exigirSesion(),
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<Pagina<VentaCuenta>>('/ventas', {
      proyectoId: q.proyectoId,
      estadoCartera: q.estadoCartera,
      buscar: q.buscar,
      pagina: q.pagina ?? 1,
      porPagina: 25,
    }),
  ]);

  const puedeVender = tienePermiso(usuario.rol, Permiso.VENTA_CREAR);
  const puedePagar = tienePermiso(usuario.rol, Permiso.PAGO_CREAR);
  const puedeContrato = tienePermiso(usuario.rol, Permiso.CONTRATO_GENERAR);
  const conAcciones = puedePagar || puedeContrato;

  // El formulario necesita el inventario disponible y los clientes activos.
  // Solo se piden si el rol puede vender.
  const [lotesDisponibles, clientesActivos] = puedeVender
    ? await Promise.all([
        api.get<Pagina<Lote>>('/lotes', { estado: 'DISPONIBLE', porPagina: 200 }),
        api.get<Pagina<Cliente>>('/clientes', { activo: true, porPagina: 200 }),
      ])
    : [null, null];

  return (
    <>
      <EncabezadoPagina
        titulo="Ventas"
        descripcion={`${ventas.total} venta(s). El saldo se calcula a partir de los pagos vigentes; nunca se almacena.`}
        acciones={
          puedeVender && lotesDisponibles && clientesActivos ? (
            <BotonRegistrarVenta
              lotes={lotesDisponibles.datos}
              clientes={clientesActivos.datos}
            />
          ) : undefined
        }
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
                {conAcciones && <Th />}
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
                  {conAcciones && (
                    <Td alinear="right">
                      {v.estado_venta !== 'ANULADA' && (
                        <AccionesFilaVenta
                          ventaId={v.venta_id}
                          saldo={v.saldo}
                          puedePagar={puedePagar}
                          puedeContrato={puedeContrato}
                        />
                      )}
                    </Td>
                  )}
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}

        <Paginacion
          pagina={ventas.pagina}
          totalPaginas={ventas.totalPaginas}
          total={ventas.total}
          ruta="/ventas"
        />
      </Card>
    </>
  );
}
