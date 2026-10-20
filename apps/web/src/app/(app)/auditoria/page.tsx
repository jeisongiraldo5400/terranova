import type { Metadata } from 'next';
import { ETIQUETA_ROL, Permiso, tienePermiso } from '@terranova/shared';
import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import type { RegistroAuditoria } from '@/lib/tipos';
import { EncabezadoPagina } from '@/components/encabezado';
import { Badge, Card, CeldaDoble, Fila, Tabla, Td, Th, Vacio } from '@/components/ui';
import { FiltrosAuditoria } from './filtros';

export const metadata: Metadata = { title: 'Auditoría' };

/* ==========================================================================
   Auditoría
   --------------------------------------------------------------------------
   Responde a "¿quién borró este pago y cuándo?", una pregunta que en el
   sistema anterior no tenía respuesta posible: los pagos se eliminaban del
   arreglo de localStorage sin dejar rastro.
   ========================================================================== */

/** Las acciones que mueven dinero se destacan; el resto es contexto. */
const TONO_ACCION: Record<string, 'peligro' | 'alerta' | 'exito' | 'marca' | 'neutro'> = {
  PAGO_ANULADO: 'peligro',
  VENTA_ANULADA: 'peligro',
  LOTE_ELIMINADO: 'peligro',
  CLIENTE_ELIMINADO: 'peligro',
  PROYECTO_ELIMINADO: 'peligro',
  USUARIO_DESACTIVADO: 'alerta',
  USUARIO_CLAVE_RESTABLECIDA: 'alerta',
  LOGIN_FALLIDO: 'alerta',
  REFRESCO_REUTILIZADO: 'peligro',
  PAGO_REGISTRADO: 'exito',
  VENTA_REGISTRADA: 'marca',
  CONTRATO_GENERADO: 'marca',
  CONTRATO_REGENERADO: 'marca',
};

const legible = (accion: string) =>
  accion.charAt(0) + accion.slice(1).toLowerCase().replace(/_/g, ' ');

export default async function PaginaAuditoria({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const usuario = await exigirSesion();

  if (!tienePermiso(usuario.rol, Permiso.AUDITORIA_VER)) {
    return (
      <>
        <EncabezadoPagina titulo="Auditoría" />
        <Card>
          <Vacio
            titulo="Sin acceso"
            descripcion="Solo un administrador puede consultar el registro de auditoría."
          />
        </Card>
      </>
    );
  }

  const registros = await api.get<RegistroAuditoria[]>('/reportes/auditoria', {
    entidad: q.entidad,
    limite: 200,
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Toda operación que mueve dinero o cambia un estado queda registrada con su autor, el momento y los valores de antes y después."
      />

      <Card>
        <div className="border-b border-muted-200/70 p-4">
          <FiltrosAuditoria valores={q} />
        </div>

        {registros.length === 0 ? (
          <Vacio
            titulo="Sin registros"
            descripcion="Aún no hay operaciones que auditar con este filtro."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Cuándo</Th>
                <Th>Quién</Th>
                <Th>Acción</Th>
                <Th>Entidad</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <Fila key={r.id}>
                  <Td className="tabular whitespace-nowrap text-xs text-muted-600">
                    {new Date(r.creadoEn).toLocaleString('es-CO', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Td>
                  <Td>
                    {r.usuario ? (
                      <CeldaDoble
                        principal={r.usuario.nombre}
                        secundario={ETIQUETA_ROL[r.usuario.rol]}
                      />
                    ) : (
                      <span className="text-muted-400">Anónimo</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tono={TONO_ACCION[r.accion] ?? 'neutro'} punto>
                      {legible(r.accion)}
                    </Badge>
                  </Td>
                  <Td className="text-muted-600">{r.entidad}</Td>
                  <Td className="max-w-md">
                    {r.despues || r.antes ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none text-xs text-brand-700 hover:underline">
                          Ver cambios
                        </summary>
                        <pre className="scroll-fino mt-2 max-h-40 overflow-auto rounded-[--radius-control] bg-muted-50 p-2.5 text-2xs leading-relaxed text-muted-700">
{JSON.stringify({ antes: r.antes, despues: r.despues }, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-300">—</span>
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
