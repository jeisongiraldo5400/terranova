import type { Metadata } from 'next';
import {
  ETIQUETA_ESTADO_CARTERA, ETIQUETA_ESTADO_LOTE, ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO,
} from '@terranova/shared';
import { api } from '@/lib/api';
import type { ProyectoResumen } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, CardEncabezado, CeldaDoble, Fila, Money, TONO_CARTERA, TONO_ESTADO_LOTE,
  Tabla, Td, Th, Vacio,
} from '@/components/ui';
import { IconoDescargar } from '@/components/iconos';
import { area, fechaCorta } from '@/lib/formato';
import { FiltroProyecto, PestanasReporte } from './filtros';

export const metadata: Metadata = { title: 'Reportes' };

interface FilaCartera {
  venta_numero: number; proyecto_nombre: string; lote_codigo: string; area_m2: string;
  cliente_documento: string; cliente_nombre: string; fecha_venta: string;
  precio_negociado: string; total_pagado: string; saldo: string;
  porcentaje_pagado: string; estado_cartera: string; total_en_mora: string;
  dias_mora_maximo: number | null; ultimo_pago: string | null;
}

interface FilaRecaudo {
  fecha: string; metodo: string; tipo: string; referencia: string | null; monto: string;
  venta_numero: number; lote_codigo: string; proyecto_nombre: string;
  cliente_documento: string; cliente_nombre: string; registrado_por: string;
}

interface FilaInventario {
  proyecto: string; etapa: string | null; codigo: string; area_m2: string;
  precio_lista: string; estado: string; comprador: string | null;
  venta_numero: number | null; precio_negociado: string | null; fecha_venta: string | null;
}

interface FilaProyeccion { mes: string; cuotas: number; por_cobrar: string }

export default async function PaginaReportes({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const ver = q.ver ?? 'cartera';
  const filtro = { proyectoId: q.proyectoId };

  const [proyectos, proyeccion, datos] = await Promise.all([
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<FilaProyeccion[]>('/reportes/proyeccion-cobros', filtro),
    ver === 'recaudo'
      ? api.get<FilaRecaudo[]>('/reportes/recaudo', filtro)
      : ver === 'inventario'
        ? api.get<FilaInventario[]>('/reportes/inventario', filtro)
        : api.get<FilaCartera[]>('/reportes/cartera', filtro),
  ]);

  const qs = q.proyectoId ? `?proyectoId=${q.proyectoId}&` : '?';

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion="Cartera, recaudo, inventario y proyección de cobros."
        acciones={
          <a
            href={`/api/reportes/exportar/${ver}${qs}reporte=${ver}`}
            className="transicion-suave inline-flex h-10 items-center gap-2 rounded-[--radius-control] bg-white px-4 text-sm font-medium text-ink-700 shadow-[--shadow-card] ring-1 ring-inset ring-muted-200 hover:bg-muted-50"
          >
            <IconoDescargar className="size-4" />
            Descargar CSV
          </a>
        }
      />

      {/* --- Proyección --- */}
      <Card className="mb-4">
        <CardEncabezado
          titulo="Proyección de cobros"
          descripcion="Lo que falta por cobrar, agrupado por mes de vencimiento"
          accion={<FiltroProyecto proyectos={proyectos} valor={q.proyectoId} />}
        />
        {proyeccion.length === 0 ? (
          <Vacio titulo="Sin cuotas pendientes" />
        ) : (
          <div className="p-5">
            <div className="flex h-44 gap-2" role="img" aria-label="Proyección de cobros por mes">
              {proyeccion.map((p) => {
                const maximo = Math.max(...proyeccion.map((x) => Number(x.por_cobrar)), 1);
                const alto = (Number(p.por_cobrar) / maximo) * 100;
                const [anio, mes] = p.mes.split('-');
                const vencido = p.mes < new Date().toISOString().slice(0, 7);
                return (
                  <div key={p.mes} className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="tabular text-center text-2xs font-medium text-muted-600">
                      {new Intl.NumberFormat('es-CO', {
                        notation: 'compact', maximumFractionDigits: 1,
                      }).format(Number(p.por_cobrar))}
                    </span>
                    <div className="relative min-h-0 w-full flex-1 rounded-t bg-muted-100/60">
                      <div
                        className={`absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-t ${
                          vencido ? 'from-danger-600 to-danger-500' : 'from-brand-600 to-brand-500'
                        }`}
                        style={{ height: `${Math.max(alto, 2)}%` }}
                        title={`${p.mes}: ${p.por_cobrar} (${p.cuotas} cuotas)`}
                      />
                    </div>
                    <span className="text-center text-2xs text-muted-400">
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

      {/* --- Reporte seleccionado --- */}
      <Card>
        <CardEncabezado
          titulo={
            ver === 'recaudo' ? 'Recaudo' : ver === 'inventario' ? 'Inventario' : 'Cartera detallada'
          }
          descripcion={`${datos.length} registro(s)`}
          accion={<PestanasReporte activa={ver} qs={qs} />}
        />

        {datos.length === 0 ? (
          <Vacio titulo="Sin datos" descripcion="No hay registros para este filtro." />
        ) : ver === 'recaudo' ? (
          <TablaRecaudo filas={datos as FilaRecaudo[]} />
        ) : ver === 'inventario' ? (
          <TablaInventario filas={datos as FilaInventario[]} />
        ) : (
          <TablaCartera filas={datos as FilaCartera[]} />
        )}
      </Card>
    </>
  );
}

function TablaCartera({ filas }: { filas: FilaCartera[] }) {
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>No.</Th>
          <Th>Lote</Th>
          <Th alinear="right">Área</Th>
          <Th>Cliente</Th>
          <Th alinear="right">Precio</Th>
          <Th alinear="right">Pagado</Th>
          <Th alinear="right">Saldo</Th>
          <Th alinear="center">Estado</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <Fila key={f.venta_numero}>
            <Td className="tabular text-muted-500">#{f.venta_numero}</Td>
            <Td><CeldaDoble principal={f.lote_codigo} secundario={f.proyecto_nombre} mono /></Td>
            <Td alinear="right" className="tabular whitespace-nowrap">{area(f.area_m2)}</Td>
            <Td className="max-w-[12rem]">
              <CeldaDoble principal={f.cliente_nombre} secundario={f.cliente_documento} />
            </Td>
            <Td alinear="right"><Money valor={f.precio_negociado} className="font-medium" /></Td>
            <Td alinear="right"><Money valor={f.total_pagado} tono="exito" /></Td>
            <Td alinear="right">
              <Money valor={f.saldo} tono={Number(f.saldo) > 0 ? 'alerta' : 'tenue'} />
              {Number(f.total_en_mora) > 0 && (
                <span className="tabular mt-0.5 block text-2xs text-danger-500">
                  {f.dias_mora_maximo} días en mora
                </span>
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
  );
}

function TablaRecaudo({ filas }: { filas: FilaRecaudo[] }) {
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Fecha</Th>
          <Th>Lote</Th>
          <Th>Cliente</Th>
          <Th>Tipo</Th>
          <Th>Método</Th>
          <Th>Referencia</Th>
          <Th>Registró</Th>
          <Th alinear="right">Monto</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <Fila key={`${f.venta_numero}-${i}`}>
            <Td className="tabular whitespace-nowrap text-muted-600">{fechaCorta(f.fecha)}</Td>
            <Td><CeldaDoble principal={f.lote_codigo} secundario={f.proyecto_nombre} mono /></Td>
            <Td className="max-w-[11rem]">
              <span className="block truncate">{f.cliente_nombre}</span>
            </Td>
            <Td className="text-muted-600">{ETIQUETA_TIPO_PAGO[f.tipo as 'ABONO'] ?? f.tipo}</Td>
            <Td className="text-muted-600">
              {ETIQUETA_METODO_PAGO[f.metodo as 'EFECTIVO'] ?? f.metodo}
            </Td>
            <Td className="font-mono text-2xs text-muted-500">{f.referencia ?? '—'}</Td>
            <Td className="text-2xs text-muted-500">{f.registrado_por}</Td>
            <Td alinear="right"><Money valor={f.monto} tono="exito" className="font-medium" /></Td>
          </Fila>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaInventario({ filas }: { filas: FilaInventario[] }) {
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Lote</Th>
          <Th>Etapa</Th>
          <Th alinear="right">Área</Th>
          <Th alinear="right">Precio lista</Th>
          <Th alinear="center">Estado</Th>
          <Th>Comprador</Th>
          <Th alinear="right">Precio venta</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <Fila key={`${f.codigo}-${i}`}>
            <Td><CeldaDoble principal={f.codigo} secundario={f.proyecto} mono /></Td>
            <Td className="text-muted-500">{f.etapa ?? '—'}</Td>
            <Td alinear="right" className="tabular whitespace-nowrap">{area(f.area_m2)}</Td>
            <Td alinear="right"><Money valor={f.precio_lista} /></Td>
            <Td alinear="center">
              <Badge tono={TONO_ESTADO_LOTE[f.estado] ?? 'neutro'} punto>
                {ETIQUETA_ESTADO_LOTE[f.estado as 'DISPONIBLE'] ?? f.estado}
              </Badge>
            </Td>
            <Td className="max-w-[12rem]">
              {f.comprador ? (
                <CeldaDoble
                  principal={f.comprador}
                  secundario={f.fecha_venta ? fechaCorta(f.fecha_venta) : undefined}
                />
              ) : (
                <span className="text-muted-300">—</span>
              )}
            </Td>
            <Td alinear="right">
              {f.precio_negociado ? (
                <Money valor={f.precio_negociado} className="font-medium" />
              ) : (
                <span className="text-muted-300">—</span>
              )}
            </Td>
          </Fila>
        ))}
      </tbody>
    </Tabla>
  );
}
