import Link from 'next/link';
import { api } from '@/lib/api';
import type { ProyectoResumen } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Money, Progreso, Vacio } from '@/components/ui';
import { IconoFlecha } from '@/components/iconos';
import { area } from '@/lib/formato';

export default async function PaginaProyectos() {
  const proyectos = await api.get<ProyectoResumen[]>('/proyectos');

  return (
    <>
      <EncabezadoPagina
        titulo="Proyectos"
        descripcion="Inventario y cartera de cada urbanización."
      />

      {proyectos.length === 0 ? (
        <Card>
          <Vacio
            titulo="Todavía no hay proyectos"
            descripcion="Cree el primer proyecto para empezar a cargar lotes."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((p) => {
            const vendidos = p.lotes_vendidos + p.lotes_pagados;
            const pctVendido = p.total_lotes ? (vendidos / p.total_lotes) * 100 : 0;

            return (
              <Card key={p.proyecto_id} className="transicion-suave flex flex-col hover:shadow-[--shadow-raised]">
                {/* --- Cabecera --- */}
                <div className="flex items-start justify-between gap-3 border-b border-muted-200/70 p-5">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold tracking-tight text-ink-900">
                      {p.nombre}
                    </h2>
                    <p className="mt-0.5 font-mono text-2xs text-muted-400">{p.codigo}</p>
                  </div>
                  <Badge tono={p.estado === 'ACTIVO' ? 'exito' : 'neutro'} punto>
                    {p.estado.charAt(0) + p.estado.slice(1).toLowerCase()}
                  </Badge>
                </div>

                {/* --- Inventario --- */}
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { n: p.lotes_disponibles, t: 'Disponibles', c: 'text-success-600' },
                      { n: p.lotes_reservados, t: 'Reservados', c: 'text-warning-600' },
                      { n: p.lotes_vendidos, t: 'Vendidos', c: 'text-brand-600' },
                      { n: p.lotes_pagados, t: 'Pagados', c: 'text-success-700' },
                    ].map((x) => (
                      <div key={x.t} className="rounded-[--radius-control] bg-muted-50 py-2.5">
                        <p className={`tabular text-lg font-semibold leading-none ${x.c}`}>{x.n}</p>
                        <p className="mt-1 text-2xs text-muted-500">{x.t}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-500">Avance de ventas</span>
                      <span className="tabular font-medium text-ink-800">
                        {vendidos} de {p.total_lotes}
                      </span>
                    </div>
                    <Progreso porcentaje={pctVendido} />
                  </div>

                  <p className="mt-3 text-xs text-muted-400">
                    {area(p.area_total_m2)} en total · {p.total_clientes} cliente(s)
                  </p>
                </div>

                {/* --- Cartera --- */}
                <dl className="mt-auto space-y-2 border-t border-muted-200/70 bg-muted-50/60 p-5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-500">Vendido</dt>
                    <dd><Money valor={p.valor_vendido} className="font-medium" /></dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-500">Recaudado</dt>
                    <dd><Money valor={p.recaudado} tono="exito" className="font-medium" /></dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-500">Por cobrar</dt>
                    <dd><Money valor={p.por_cobrar} tono="alerta" className="font-medium" /></dd>
                  </div>
                  {Number(p.en_mora) > 0 && (
                    <div className="flex justify-between gap-2 border-t border-muted-200 pt-2">
                      <dt className="font-medium text-danger-600">En mora</dt>
                      <dd><Money valor={p.en_mora} tono="peligro" className="font-semibold" /></dd>
                    </div>
                  )}
                </dl>

                <Link
                  href={{ pathname: '/lotes', query: { proyectoId: p.proyecto_id } }}
                  className="transicion-suave flex items-center justify-between border-t border-muted-200/70 px-5 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Ver lotes del proyecto
                  <IconoFlecha className="size-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
