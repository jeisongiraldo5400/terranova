import { api } from '@/lib/api';
import type { Lote, Pagina, ProyectoResumen } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Money, Tabla, Td, Th, TONO_ESTADO_LOTE, Vacio } from '@/components/ui';
import { area, fechaCorta } from '@/lib/formato';
import { ETIQUETA_ESTADO_LOTE } from '@terranova/shared';
import { FiltrosLotes } from './filtros';

export default async function PaginaLotes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;

  const [proyectos, lotes] = await Promise.all([
    api.get<ProyectoResumen[]>('/proyectos'),
    api.get<Pagina<Lote>>('/lotes', {
      proyectoId: q.proyectoId,
      estado: q.estado,
      buscar: q.buscar,
      pagina: q.pagina ?? 1,
      porPagina: 50,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Lotes"
        descripcion={`${lotes.total} lote(s) · área mínima 1.000 m²`}
      />

      <Card>
        <div className="border-b border-muted-200 p-4">
          <FiltrosLotes proyectos={proyectos} valores={q} />
        </div>

        {lotes.datos.length === 0 ? (
          <Vacio
            titulo="Ningún lote coincide"
            descripcion="Ajuste los filtros o cree lotes en el proyecto."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Proyecto</Th>
                <Th>Etapa</Th>
                <Th alinear="right">Área</Th>
                <Th alinear="right">Precio lista</Th>
                <Th>Estado</Th>
                <Th>Comprador</Th>
                <Th alinear="right">Venta</Th>
              </tr>
            </thead>
            <tbody>
              {lotes.datos.map((l) => {
                const venta = l.ventas[0];
                return (
                  <tr key={l.id} className="hover:bg-muted-100">
                    <Td className="font-mono font-medium text-ink-900">{l.codigo}</Td>
                    <Td className="text-muted-600">{l.proyecto.nombre}</Td>
                    <Td className="text-muted-600">{l.etapa?.nombre ?? '—'}</Td>
                    <Td alinear="right" className="tabular">{area(l.areaM2)}</Td>
                    <Td alinear="right"><Money valor={l.precioLista} /></Td>
                    <Td>
                      <Badge tono={TONO_ESTADO_LOTE[l.estado] ?? 'neutro'}>
                        {ETIQUETA_ESTADO_LOTE[l.estado]}
                      </Badge>
                    </Td>
                    <Td className="max-w-[14rem] truncate text-muted-600">
                      {venta?.cliente.nombre ?? '—'}
                    </Td>
                    <Td alinear="right" className="tabular whitespace-nowrap text-muted-600">
                      {venta ? `${fechaCorta(venta.fechaVenta)} · #${venta.numero}` : '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  );
}
