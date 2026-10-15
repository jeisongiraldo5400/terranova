import Link from 'next/link';
import { api } from '@/lib/api';
import type { Cliente, Pagina } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Tabla, Td, Th, Vacio } from '@/components/ui';
import { BuscadorClientes } from './buscador';

export default async function PaginaClientes({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const clientes = await api.get<Pagina<Cliente>>('/clientes', {
    buscar: q.buscar,
    pagina: q.pagina ?? 1,
    porPagina: 50,
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={`${clientes.total} cliente(s). Un mismo comprador es un solo registro, compre en el proyecto que compre.`}
      />

      <Card>
        <div className="border-b border-muted-200 p-4">
          <BuscadorClientes valor={q.buscar ?? ''} />
        </div>

        {clientes.datos.length === 0 ? (
          <Vacio
            titulo="Ningún cliente coincide"
            descripcion="La búsqueda ignora tildes y mayúsculas; pruebe con parte del nombre o la cédula."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Documento</Th>
                <Th>Nombre</Th>
                <Th>Teléfono</Th>
                <Th>Ciudad</Th>
                <Th alinear="center">Compras</Th>
                <Th alinear="center">Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {clientes.datos.map((c) => (
                <tr key={c.id} className="hover:bg-muted-100">
                  <Td className="tabular font-mono">{c.documento}</Td>
                  <Td className="font-medium text-ink-900">{c.nombre}</Td>
                  <Td className="tabular text-muted-600">{c.telefono}</Td>
                  <Td className="text-muted-600">{c.ciudad ?? '—'}</Td>
                  <Td alinear="center" className="tabular">{c._count?.ventas ?? 0}</Td>
                  <Td alinear="center">
                    <Badge tono={c.activo ? 'exito' : 'neutro'}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td alinear="right">
                    <Link
                      href={`/clientes/${c.id}`}
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
