import { ETIQUETA_ESTADO_LOTE, Permiso, tienePermiso } from '@terranova/shared';
import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import type { Lote, Pagina, Proyecto, ProyectoResumen } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import {
  Badge, Card, CeldaDoble, Fila, Money, TONO_ESTADO_LOTE, Tabla, Td, Th, Vacio,
} from '@/components/ui';
import { Paginacion } from '@/components/paginacion';
import { area, fechaCorta } from '@/lib/formato';
import { FiltrosLotes } from './filtros';
import { AccionesLote, BotonesLote } from './acciones';

export default async function PaginaLotes({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;

  const [usuario, proyectos, lotes] = await Promise.all([
    exigirSesion(),
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<Pagina<Lote>>('/lotes', {
      proyectoId: q.proyectoId,
      estado: q.estado,
      buscar: q.buscar,
      pagina: q.pagina ?? 1,
      porPagina: 25,
    }),
  ]);

  const puedeGestionar = tienePermiso(usuario.rol, Permiso.LOTE_GESTIONAR);

  // Las etapas se piden solo si hacen falta para los formularios.
  const etapasPorProyecto: Record<string, Proyecto['etapas']> = {};
  if (puedeGestionar) {
    const detalles = await Promise.all(
      proyectos.map((p) => api.get<Proyecto>(`/proyectos/${p.proyecto_id}`)),
    );
    for (const d of detalles) etapasPorProyecto[d.id] = d.etapas;
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Lotes"
        descripcion={`${lotes.total} lote(s). El área mínima es de 1.000 m², validada por el proyecto.`}
        acciones={
          puedeGestionar ? (
            <BotonesLote proyectos={proyectos} etapasPorProyecto={etapasPorProyecto} />
          ) : undefined
        }
      />

      <Card>
        <div className="border-b border-muted-200/70 p-4">
          <FiltrosLotes proyectos={proyectos} valores={q} />
        </div>

        {lotes.datos.length === 0 ? (
          <Vacio
            titulo="Ningún lote coincide"
            descripcion="Ajuste los filtros o cargue lotes en el proyecto."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Proyecto</Th>
                <Th alinear="right">Área</Th>
                <Th alinear="right">Precio lista</Th>
                <Th alinear="center">Estado</Th>
                <Th>Comprador</Th>
                {puedeGestionar && <Th alinear="right">Acciones</Th>}
              </tr>
            </thead>
            <tbody>
              {lotes.datos.map((l) => {
                const venta = l.ventas[0];
                return (
                  <Fila key={l.id}>
                    <Td className="font-mono text-xs font-medium text-ink-900">{l.codigo}</Td>
                    <Td>
                      <CeldaDoble
                        principal={l.proyecto.nombre}
                        secundario={l.etapa?.nombre ?? undefined}
                      />
                    </Td>
                    <Td alinear="right" className="tabular whitespace-nowrap">{area(l.areaM2)}</Td>
                    <Td alinear="right"><Money valor={l.precioLista} className="font-medium" /></Td>
                    <Td alinear="center">
                      <Badge tono={TONO_ESTADO_LOTE[l.estado] ?? 'neutro'} punto>
                        {ETIQUETA_ESTADO_LOTE[l.estado]}
                      </Badge>
                    </Td>
                    <Td className="max-w-[13rem]">
                      {venta ? (
                        <CeldaDoble
                          principal={venta.cliente.nombre}
                          secundario={`#${venta.numero} · ${fechaCorta(venta.fechaVenta)}`}
                        />
                      ) : (
                        <span className="text-muted-300">—</span>
                      )}
                    </Td>
                    {puedeGestionar && (
                      <Td alinear="right">
                        <AccionesLote
                          lote={l}
                          proyectos={proyectos}
                          etapasPorProyecto={etapasPorProyecto}
                        />
                      </Td>
                    )}
                  </Fila>
                );
              })}
            </tbody>
          </Tabla>
        )}

        <Paginacion
          pagina={lotes.pagina}
          totalPaginas={lotes.totalPaginas}
          total={lotes.total}
          ruta="/lotes"
        />
      </Card>
    </>
  );
}
