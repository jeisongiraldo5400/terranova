import Link from 'next/link';
import { Permiso, tienePermiso } from '@terranova/shared';
import { api } from '@/lib/api';
import type { Pagina, Pago, VentaCuenta } from '@/lib/tipos';
import { exigirSesion } from '@/lib/sesion';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CeldaDoble, Fila, Money, Tabla, Td, Th, Vacio } from '@/components/ui';
import { Boton } from '@/components/controles';
import { fechaCorta, opcionVenta } from '@/lib/formato';
import { BotonRegistrarPago } from './registrar';
import { ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO } from '@terranova/shared';

export default async function PaginaPagos({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const incluirAnulados = q.anulados === '1';

  const [usuario, pagos] = await Promise.all([
    exigirSesion(),
    api.get<Pagina<Pago>>('/pagos', {
      incluirAnulados,
      pagina: q.pagina ?? 1,
      porPagina: 60,
    }),
  ]);

  // Ventas a las que se puede abonar: vigentes y con saldo. Solo se piden
  // si el rol puede registrar pagos.
  const ventasConSaldo = tienePermiso(usuario.rol, Permiso.PAGO_CREAR)
    ? (await api.get<Pagina<VentaCuenta>>('/ventas', { porPagina: 200 })).datos
        .filter((v) => v.estado_venta !== 'ANULADA' && Number(v.saldo) > 0)
        .map(opcionVenta)
    : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos"
        descripcion={`${pagos.total} pago(s) registrado(s)`}
        acciones={
          <>
            <Link href={incluirAnulados ? '/pagos' : '/pagos?anulados=1'}>
              <Boton variante="secundario" tamano="md">
                {incluirAnulados ? 'Ocultar anulados' : 'Mostrar anulados'}
              </Boton>
            </Link>
            {ventasConSaldo && <BotonRegistrarPago ventas={ventasConSaldo} />}
          </>
        }
      />

      <Card>
        {pagos.datos.length === 0 ? (
          <Vacio
            titulo="Sin pagos registrados"
            descripcion="Use «Registrar pago» o el detalle de cada venta para registrar un abono."
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
                <Fila key={p.id} className={p.anulado ? 'opacity-55' : ''}>
                  <Td className="tabular whitespace-nowrap">{fechaCorta(p.fecha)}</Td>
                  <Td className="tabular">
                    <Link
                      href={`/ventas/${p.ventaId}`}
                      className="transicion-suave tabular font-semibold text-brand-700 hover:underline"
                    >
                      #{p.venta?.numero}
                    </Link>
                  </Td>
                  <Td>
                    <CeldaDoble
                      principal={p.venta?.lote.codigo}
                      secundario={p.venta?.lote.proyecto.nombre}
                      mono
                    />
                  </Td>
                  <Td className="max-w-[12rem] truncate">{p.venta?.cliente.nombre}</Td>
                  <Td className="text-muted-600">{ETIQUETA_TIPO_PAGO[p.tipo]}</Td>
                  <Td className="text-muted-600">{ETIQUETA_METODO_PAGO[p.metodo]}</Td>
                  <Td className="font-mono text-2xs text-muted-500">{p.referencia ?? '—'}</Td>
                  <Td alinear="right">
                    <Money
                      valor={p.monto}
                      className={`font-medium ${p.anulado ? 'line-through' : ''}`}
                      tono={p.anulado ? 'tenue' : 'exito'}
                    />
                  </Td>
                  <Td alinear="center">
                    {p.anulado ? (
                      <Badge tono="peligro" punto title={p.motivoAnulacion ?? ''}>
                        Anulado
                      </Badge>
                    ) : (
                      <Badge tono="exito" punto>Vigente</Badge>
                    )}
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
