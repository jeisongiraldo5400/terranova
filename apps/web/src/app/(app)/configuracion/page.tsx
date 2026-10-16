import { api } from '@/lib/api';
import { exigirSesion } from '@/lib/sesion';
import { EncabezadoPagina } from '@/components/encabezado';
import { Aviso, Badge, Card, CardEncabezado, Fila, Tabla, Td, Th, Vacio } from '@/components/ui';
import { fechaCorta } from '@/lib/formato';
import { ETIQUETA_ROL, Permiso, tienePermiso } from '@terranova/shared';
import { FormularioEmpresa } from './formulario-empresa';

interface Empresa {
  razonSocial: string; nit: string; direccion: string; ciudad: string;
  telefono: string; email: string; representanteLegal: string;
  documentoRepresentante: string; clausulasContrato: string | null;
}

interface Usuario {
  id: string; email: string; nombre: string; rol: 'ADMIN' | 'SECRETARIA' | 'EMPLEADO';
  activo: boolean; ultimoAcceso: string | null;
}

export default async function PaginaConfiguracion() {
  const usuario = await exigirSesion();
  const puedeGestionar = tienePermiso(usuario.rol, Permiso.CONFIG_GESTIONAR);
  const puedeUsuarios = tienePermiso(usuario.rol, Permiso.USUARIO_GESTIONAR);

  const [empresa, usuarios] = await Promise.all([
    api.get<Empresa | null>('/configuracion/empresa'),
    puedeUsuarios ? api.get<Usuario[]>('/configuracion/usuarios') : Promise.resolve([]),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Datos de la empresa para los contratos y gestión de usuarios"
      />

      <div className="space-y-4">
        <Card>
          <CardEncabezado
            titulo="Datos de la empresa"
            descripcion="Aparecen en el encabezado y las cláusulas de cada contrato generado"
          />
          <div className="p-5">
            {!empresa && (
              <div className="mb-4">
                <Aviso tono="alerta" titulo="Falta configurar la empresa">
                  Sin estos datos no se pueden emitir contratos.
                </Aviso>
              </div>
            )}
            <FormularioEmpresa inicial={empresa} soloLectura={!puedeGestionar} />
          </div>
        </Card>

        {puedeUsuarios && (
          <Card>
            <CardEncabezado
              titulo="Usuarios"
              descripcion="Los permisos se derivan del rol; se aplican en la API, no solo en la interfaz"
            />
            {usuarios.length === 0 ? (
              <Vacio titulo="Sin usuarios" />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Nombre</Th>
                    <Th>Correo</Th>
                    <Th>Rol</Th>
                    <Th>Último acceso</Th>
                    <Th alinear="center">Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <Fila key={u.id}>
                      <Td className="font-medium text-ink-900">{u.nombre}</Td>
                      <Td className="text-muted-600">{u.email}</Td>
                      <Td>
                        <Badge tono={u.rol === 'ADMIN' ? 'marca' : 'neutro'} punto>
                          {ETIQUETA_ROL[u.rol]}
                        </Badge>
                      </Td>
                      <Td className="tabular text-muted-600">
                        {u.ultimoAcceso ? fechaCorta(u.ultimoAcceso) : 'Nunca'}
                      </Td>
                      <Td alinear="center">
                        <Badge tono={u.activo ? 'exito' : 'neutro'} punto>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
