import { api } from '@/lib/api';
import type { Contrato } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CeldaDoble, Fila, Money, Tabla, Td, Th, Vacio } from '@/components/ui';
import { IconoDescargar } from '@/components/iconos';
import { fechaCorta } from '@/lib/formato';

export default async function PaginaContratos() {
  const contratos = await api.get<Contrato[]>('/contratos');

  return (
    <>
      <EncabezadoPagina
        titulo="Contratos"
        descripcion="Generados en el servidor, numerados de forma consecutiva y archivados con su huella sha256"
      />

      <Card>
        {contratos.length === 0 ? (
          <Vacio
            titulo="Sin contratos emitidos"
            descripcion="El contrato se genera desde el detalle de cada venta."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th alinear="center">Versión</Th>
                <Th>Emitido</Th>
                <Th>Lote</Th>
                <Th>Comprador</Th>
                <Th alinear="right">Precio</Th>
                <Th>Huella sha256</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <Fila key={c.id}>
                  <Td className="font-mono font-medium text-ink-900">{c.numero}</Td>
                  <Td alinear="center"><Badge tono="neutro">v{c.version}</Badge></Td>
                  <Td className="tabular whitespace-nowrap text-muted-600">
                    {fechaCorta(c.generadoEn)}
                    <span className="block text-xs">{c.generadoPor?.nombre}</span>
                  </Td>
                  <Td>
                    <CeldaDoble
                      principal={c.venta?.lote.codigo}
                      secundario={c.venta?.lote.proyecto.nombre}
                      mono
                    />
                  </Td>
                  <Td className="max-w-[13rem] truncate">{c.venta?.cliente.nombre}</Td>
                  <Td alinear="right">
                    <Money valor={c.venta?.precioNegociado ?? '0'} />
                  </Td>
                  <Td
                    className="font-mono text-2xs text-muted-400"
                    title={`${c.sha256} · ${c.bytes} bytes`}
                  >
                    {c.sha256.slice(0, 12)}…
                  </Td>
                  <Td alinear="right">
                    <a
                      href={`/api/contratos/${c.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="transicion-suave inline-flex items-center gap-1.5 rounded-[--radius-control] px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      <IconoDescargar className="size-3.5" />
                      PDF
                    </a>
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
