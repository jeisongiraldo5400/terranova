import Link from 'next/link';
import { api } from '@/lib/api';
import type { ProyectoResumen } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Money, Progreso, Vacio } from '@/components/ui';
import { area } from '@/lib/formato';

export default async function PaginaProyectos() {
  const proyectos = await api.get<ProyectoResumen[]>('/proyectos');

  return (
    <>
      <EncabezadoPagina
        titulo="Proyectos"
        descripcion="Inventario y cartera de cada urbanización"
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
              <Card key={p.proyecto_id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink-900">{p.nombre}</h2>
                    <p className="mt-0.5 font-mono text-xs text-muted-500">{p.codigo}</p>
                  </div>
                  <Badge tono={p.estado === 'ACTIVO' ? 'exito' : 'neutro'}>{p.estado}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-500">Lotes</dt>
                    <dd className="tabular font-medium text-ink-900">{p.total_lotes}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-500">Área total</dt>
                    <dd className="tabular font-medium text-ink-900">{area(p.area_total_m2)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-500">Disponibles</dt>
                    <dd className="tabular font-medium text-success-600">{p.lotes_disponibles}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-500">Clientes</dt>
                    <dd className="tabular font-medium text-ink-900">{p.total_clientes}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted-600">
                    <span>Vendido</span>
                    <span className="tabular">
                      {vendidos} de {p.total_lotes}
                    </span>
                  </div>
                  <Progreso porcentaje={pctVendido} />
                </div>

                <dl className="mt-4 space-y-1.5 border-t border-muted-200 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-600">Vendido</dt>
                    <dd><Money valor={p.valor_vendido} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-600">Recaudado</dt>
                    <dd><Money valor={p.recaudado} tono="exito" /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-600">Por cobrar</dt>
                    <dd><Money valor={p.por_cobrar} tono="alerta" /></dd>
                  </div>
                  {Number(p.en_mora) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-600">En mora</dt>
                      <dd><Money valor={p.en_mora} tono="peligro" /></dd>
                    </div>
                  )}
                </dl>

                <Link
                  href={{ pathname: '/lotes', query: { proyectoId: p.proyecto_id } }}
                  className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Ver lotes →
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
