import Link from 'next/link';
import { Permiso, tienePermiso } from '@terranova/shared';
import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import type { Cliente, Pagina } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, Fila, Tabla, Td, Th, Vacio } from '@/components/ui';
import { BuscadorClientes } from './buscador';
import { AccionesCliente, BotonNuevoCliente } from './acciones';
import { Paginacion } from '@/components/paginacion';

export default async function PaginaClientes({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const [usuario, clientes] = await Promise.all([
    exigirSesion(),
    api.get<Pagina<Cliente>>('/clientes', {
      buscar: q.buscar,
      pagina: q.pagina ?? 1,
      porPagina: 25,
    }),
  ]);

  const puedeGestionar = tienePermiso(usuario.rol, Permiso.CLIENTE_GESTIONAR);

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={`${clientes.total} cliente(s). Un mismo comprador es un solo registro, compre en el proyecto que compre.`}
        acciones={puedeGestionar ? <BotonNuevoCliente /> : undefined}
      />

      <Card>
        <div className="border-b border-muted-200/70 p-4">
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
                <Th>Cliente</Th>
                <Th>Documento</Th>
                <Th>Teléfono</Th>
                <Th>Ciudad</Th>
                <Th alinear="center">Compras</Th>
                <Th alinear="center">Estado</Th>
                <Th alinear="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {clientes.datos.map((c) => (
                <Fila key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-2xs font-semibold text-brand-700">
                        {c.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate font-medium text-ink-900">{c.nombre}</span>
                    </div>
                  </Td>
                  <Td className="tabular font-mono text-xs text-muted-600">{c.documento}</Td>
                  <Td className="tabular text-muted-600">{c.telefono}</Td>
                  <Td className="text-muted-500">{c.ciudad ?? '—'}</Td>
                  <Td alinear="center">
                    {c._count?.ventas ? (
                      <Badge tono="marca">{c._count.ventas}</Badge>
                    ) : (
                      <span className="text-muted-300">—</span>
                    )}
                  </Td>
                  <Td alinear="center">
                    <Badge tono={c.activo ? 'exito' : 'neutro'} punto>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td alinear="right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="transicion-suave rounded-[--radius-control] px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Ver ficha
                      </Link>
                      {puedeGestionar && <AccionesCliente cliente={c} />}
                    </div>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}

        <Paginacion pagina={clientes.pagina} totalPaginas={clientes.totalPaginas} total={clientes.total} ruta="/clientes" />
      </Card>
    </>
  );
}
