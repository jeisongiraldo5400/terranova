import Link from 'next/link';
import { api } from '@/lib/api';
import type { Pagina, Pago } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Money, Tabla, Td, Th, Vacio } from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO } from '@terranova/shared';

export default async function PaginaPagos({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const incluirAnulados = q.anulados === '1';

  const pagos = await api.get<Pagina<Pago>>('/pagos', {
    incluirAnulados,
    pagina: q.pagina ?? 1,
    porPagina: 60,
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos"
        descripcion={`${pagos.total} pago(s) registrado(s)`}
        acciones={
          <Link
            href={incluirAnulados ? '/pagos' : '/pagos?anulados=1'}
            className="rounded-[--radius-control] bg-white px-3.5 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-muted-300 hover:bg-muted-100"
          >
            {incluirAnulados ? 'Ocultar anulados' : 'Mostrar anulados'}
          </Link>
        }
      />

      <Card>
        {pagos.datos.length === 0 ? (
          <Vacio
            titulo="Sin pagos registrados"
            descripcion="Los abonos se registran desde el detalle de cada venta."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Venta</Th>
                <Th>Lote</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Método</Th>
                <Th>Referencia</Th>
                <Th alinear="right">Monto</Th>
                <Th alinear="center">Estado</Th>
              </tr>
            </thead>
            <tbody>
              {pagos.datos.map((p) => (
                <tr key={p.id} className={p.anulado ? 'opacity-60' : 'hover:bg-muted-100'}>
                  <Td className="tabular whitespace-nowrap">{fechaCorta(p.fecha)}</Td>
                  <Td className="tabular">
                    <Link
                      href={`/ventas/${p.ventaId}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      #{p.venta?.numero}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-ink-900">{p.venta?.lote.codigo}</span>
                    <span className="block max-w-[9rem] truncate text-xs text-muted-500">
                      {p.venta?.lote.proyecto.nombre}
                    </span>
                  </Td>
                  <Td className="max-w-[12rem] truncate">{p.venta?.cliente.nombre}</Td>
                  <Td className="text-muted-600">{ETIQUETA_TIPO_PAGO[p.tipo]}</Td>
                  <Td className="text-muted-600">{ETIQUETA_METODO_PAGO[p.metodo]}</Td>
                  <Td className="tabular font-mono text-xs text-muted-600">
                    {p.referencia ?? '—'}
                  </Td>
                  <Td alinear="right">
                    <Money
                      valor={p.monto}
                      className={p.anulado ? 'line-through' : ''}
                      tono={p.anulado ? undefined : 'exito'}
                    />
                  </Td>
                  <Td alinear="center">
                    {p.anulado ? (
                      <span title={p.motivoAnulacion ?? ''}>
                        <Badge tono="peligro">Anulado</Badge>
                      </span>
                    ) : (
                      <Badge tono="exito">Vigente</Badge>
                    )}
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
