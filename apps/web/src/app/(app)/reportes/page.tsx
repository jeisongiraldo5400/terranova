import { api } from '@/lib/api';
import type { ProyectoResumen, VentaCuenta } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CardEncabezado, CeldaDoble, Fila, Money, Tabla, Td, Th, TONO_CARTERA, Vacio } from '@/components/ui';
import { IconoDescargar } from '@/components/iconos';
import { area, fechaCorta } from '@/lib/formato';
import { ETIQUETA_ESTADO_CARTERA } from '@terranova/shared';

interface FilaCartera {
  venta_numero: number; proyecto_nombre: string; lote_codigo: string; area_m2: string;
  cliente_documento: string; cliente_nombre: string; fecha_venta: string;
  precio_negociado: string; total_pagado: string; saldo: string;
  porcentaje_pagado: string; estado_cartera: string; total_en_mora: string;
  dias_mora_maximo: number | null; ultimo_pago: string | null;
}

interface FilaProyeccion {
  mes: string; cuotas: number; por_cobrar: string;
}

export default async function PaginaReportes({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;

  const [proyectos, cartera, proyeccion] = await Promise.all([
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<FilaCartera[]>('/reportes/cartera', { proyectoId: q.proyectoId }),
    api.get<FilaProyeccion[]>('/reportes/proyeccion-cobros', { proyectoId: q.proyectoId }),
  ]);

  const qs = q.proyectoId ? `?proyectoId=${q.proyectoId}` : '';

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Cartera, recaudo, inventario y proyección de cobros"
        acciones={
          <div className="flex gap-2">
            {(['cartera', 'recaudo', 'inventario'] as const).map((r) => (
              <a
                key={r}
                href={`/api/reportes/exportar/${r}${qs ? `${qs}&` : '?'}reporte=${r}`}
                className="transicion-suave inline-flex h-10 items-center gap-2 rounded-[--radius-control] bg-white px-4 text-sm font-medium text-ink-700 shadow-[--shadow-card] ring-1 ring-inset ring-muted-200 hover:bg-muted-50 hover:ring-muted-300"
              >
                <IconoDescargar className="size-4" />
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </a>
            ))}
          </div>
        }
      />

      <Card className="mb-4">
        <CardEncabezado
          titulo="Proyección de cobros"
          descripcion="Lo que falta por cobrar, agrupado por mes de vencimiento"
        />
        {proyeccion.length === 0 ? (
          <Vacio titulo="Sin cuotas pendientes" />
        ) : (
          <div className="p-5">
            {/* items-stretch: con items-end las columnas se encogen y la
                altura en % de la barra no tiene contra que resolver. */}
            <div className="flex h-44 gap-2" role="img" aria-label="Proyeccion de cobros por mes">
              {proyeccion.map((p) => {
                const maximo = Math.max(...proyeccion.map((x) => Number(x.por_cobrar)), 1);
                const alto = (Number(p.por_cobrar) / maximo) * 100;
                const [anio, mes] = p.mes.split('-');
                const vencido = p.mes < new Date().toISOString().slice(0, 7);
                return (
                  <div key={p.mes} className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="tabular text-center text-[10px] font-medium text-muted-600">
                      {new Intl.NumberFormat('es-CO', {
                        notation: 'compact', maximumFractionDigits: 1,
                      }).format(Number(p.por_cobrar))}
                    </span>
                    <div className="relative min-h-0 w-full flex-1 rounded-t bg-muted-100/60">
                      <div
                        className={`absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-t ${vencido ? 'from-danger-600 to-danger-500' : 'from-brand-600 to-brand-500'}`}
                        style={{ height: `${Math.max(alto, 2)}%` }}
                        title={`${p.mes}: ${p.por_cobrar} (${p.cuotas} cuotas)`}
                      />
                    </div>
                    <span className="text-center text-[10px] text-muted-500">
                      {mes}/{anio?.slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-500">
              En rojo, los meses ya vencidos que siguen sin cubrirse.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardEncabezado
          titulo="Cartera detallada"
          descripcion={`${cartera.length} venta(s)`}
        />
        {cartera.length === 0 ? (
          <Vacio titulo="Sin datos de cartera" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Proyecto / lote</Th>
                <Th alinear="right">Área</Th>
                <Th>Cliente</Th>
                <Th>Venta</Th>
                <Th alinear="right">Precio</Th>
                <Th alinear="right">Pagado</Th>
                <Th alinear="right">Saldo</Th>
                <Th alinear="right">Mora</Th>
                <Th alinear="center">Estado</Th>
              </tr>
            </thead>
            <tbody>
              {cartera.map((f) => (
                <Fila key={f.venta_numero}>
                  <Td className="tabular">#{f.venta_numero}</Td>
                  <Td>
                    <CeldaDoble principal={f.lote_codigo} secundario={f.proyecto_nombre} mono />
                  </Td>
                  <Td alinear="right" className="tabular whitespace-nowrap">{area(f.area_m2)}</Td>
                  <Td className="max-w-[12rem]">
                    <CeldaDoble principal={f.cliente_nombre} secundario={f.cliente_documento} />
                  </Td>
                  <Td className="tabular whitespace-nowrap text-muted-600">
                    {fechaCorta(f.fecha_venta)}
                  </Td>
                  <Td alinear="right"><Money valor={f.precio_negociado} /></Td>
                  <Td alinear="right"><Money valor={f.total_pagado} tono="exito" /></Td>
                  <Td alinear="right"><Money valor={f.saldo} /></Td>
                  <Td alinear="right">
                    {Number(f.total_en_mora) > 0 ? (
                      <>
                        <Money valor={f.total_en_mora} tono="peligro" />
                        <span className="tabular block text-[10px] text-danger-600">
                          {f.dias_mora_maximo} días
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-400">—</span>
                    )}
                  </Td>
                  <Td alinear="center">
                    <Badge tono={TONO_CARTERA[f.estado_cartera] ?? 'neutro'} punto>
                      {ETIQUETA_ESTADO_CARTERA[f.estado_cartera as 'PAGADO'] ?? f.estado_cartera}
                    </Badge>
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
