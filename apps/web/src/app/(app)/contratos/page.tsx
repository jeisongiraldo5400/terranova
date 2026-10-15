import { api } from '@/lib/api';
import type { Contrato } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Card, Money, Tabla, Td, Th, Vacio } from '@/components/ui';
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
                <tr key={c.id} className="hover:bg-muted-100">
                  <Td className="font-mono font-medium text-ink-900">{c.numero}</Td>
                  <Td alinear="center" className="tabular">v{c.version}</Td>
                  <Td className="tabular whitespace-nowrap text-muted-600">
                    {fechaCorta(c.generadoEn)}
                    <span className="block text-xs">{c.generadoPor?.nombre}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-ink-900">{c.venta?.lote.codigo}</span>
                    <span className="block max-w-[9rem] truncate text-xs text-muted-500">
                      {c.venta?.lote.proyecto.nombre}
                    </span>
                  </Td>
                  <Td className="max-w-[13rem] truncate">{c.venta?.cliente.nombre}</Td>
                  <Td alinear="right">
                    <Money valor={c.venta?.precioNegociado ?? '0'} />
                  </Td>
                  <Td
                    className="font-mono text-[10px] text-muted-500"
                    title={`${c.sha256} · ${c.bytes} bytes`}
                  >
                    {c.sha256.slice(0, 12)}…
                  </Td>
                  <Td alinear="right">
                    <a
                      href={`/api/contratos/${c.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Abrir PDF
                    </a>
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
