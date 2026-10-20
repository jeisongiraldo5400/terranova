'use client';

import { useState } from 'react';
import { z } from 'zod';
import { ETIQUETA_ROL, PERMISOS_POR_ROL, Rol, crearUsuarioSchema, passwordSchema } from '@terranova/shared';
import { api } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { Boton, Campo, Entrada, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { Aviso, Badge } from '@/components/ui';
import { IconoMas } from '@/components/iconos';
import type { UsuarioSistema } from '@/lib/tipos';

const cambiarRolSchema = z.object({ rol: z.nativeEnum(Rol) });
const cambiarEstadoSchema = z.object({ activo: z.boolean() });
const restablecerSchema = z.object({ password: passwordSchema });

/* ==========================================================================
   Gestión de usuarios
   --------------------------------------------------------------------------
   El v0 no tenía usuarios: Login.jsx comparaba contra admin/1234 en el
   código y asignaba siempre rol Administrador. Los tres roles del
   documento original existen aquí y se aplican en la API.
   ========================================================================== */

export function BotonNuevoUsuario() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton tamano="sm" onClick={() => setAbierto(true)} iconoIzq={<IconoMas className="size-3.5" />}>
        Nuevo usuario
      </Boton>
      {abierto && <FormularioUsuario onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function FormularioUsuario({ onCerrar }: { onCerrar: () => void }) {
  const [rol, setRol] = useState<Rol>(Rol.SECRETARIA);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: crearUsuarioSchema,
    enviar: (datos) => api.post('/configuracion/usuarios', datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo="Nuevo usuario"
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Crear usuario"
    >
      <Rejilla>
        <Campo etiqueta="Nombre completo" error={errores.nombre} requerido>
          <Entrada name="nombre" error={Boolean(errores.nombre)} autoFocus />
        </Campo>

        <Campo etiqueta="Correo electrónico" error={errores.email} requerido>
          <Entrada
            name="email"
            type="email"
            placeholder="usuario@terranova.co"
            error={Boolean(errores.email)}
          />
        </Campo>
      </Rejilla>

      <Campo
        etiqueta="Contraseña"
        error={errores.password}
        ayuda="Mínimo 10 caracteres, con mayúscula, minúscula y número"
        requerido
      >
        <Entrada name="password" type="password" error={Boolean(errores.password)} />
      </Campo>

      <Campo etiqueta="Rol" error={errores.rol} requerido>
        <Seleccion name="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {Object.values(Rol).map((r) => (
            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
          ))}
        </Seleccion>
      </Campo>

      {/* Qué puede hacer el rol elegido, derivado de la misma matriz que
          autoriza la API. */}
      <div className="rounded-[--radius-control] bg-muted-50 px-3.5 py-3">
        <p className="mb-2 text-xs font-medium text-ink-800">
          Permisos de {ETIQUETA_ROL[rol]}
        </p>
        <div className="flex flex-wrap gap-1">
          {PERMISOS_POR_ROL[rol].map((p) => (
            <Badge key={p} tono="neutro">{p}</Badge>
          ))}
        </div>
      </div>
    </FormularioDialogo>
  );
}

/* --- Acciones por usuario -------------------------------------------------- */

export function AccionesUsuario({
  usuario, esUsuarioActual,
}: { usuario: UsuarioSistema; esUsuarioActual: boolean }) {
  const [dialogo, setDialogo] = useState<'rol' | 'clave' | 'estado' | null>(null);

  return (
    <div className="flex justify-end gap-1">
      <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo('rol')}>
        Rol
      </Boton>
      <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo('clave')}>
        Clave
      </Boton>
      {!esUsuarioActual && (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => setDialogo('estado')}
          className={usuario.activo ? 'text-danger-600 hover:bg-danger-50' : ''}
        >
          {usuario.activo ? 'Desactivar' : 'Activar'}
        </Boton>
      )}

      {dialogo === 'rol' && <DialogoRol usuario={usuario} onCerrar={() => setDialogo(null)} />}
      {dialogo === 'clave' && <DialogoClave usuario={usuario} onCerrar={() => setDialogo(null)} />}
      {dialogo === 'estado' && <DialogoEstado usuario={usuario} onCerrar={() => setDialogo(null)} />}
    </div>
  );
}

function DialogoRol({ usuario, onCerrar }: { usuario: UsuarioSistema; onCerrar: () => void }) {
  const [rol, setRol] = useState<Rol>(usuario.rol);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: cambiarRolSchema,
    enviar: (datos) => api.patch(`/configuracion/usuarios/${usuario.id}/rol`, datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Rol de ${usuario.nombre}`}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar({ rol });
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Cambiar rol"
    >
      <Campo etiqueta="Rol" error={errores.rol} requerido>
        <Seleccion value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {Object.values(Rol).map((r) => (
            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
          ))}
        </Seleccion>
      </Campo>

      <div className="rounded-[--radius-control] bg-muted-50 px-3.5 py-3">
        <p className="mb-2 text-xs font-medium text-ink-800">Permisos de {ETIQUETA_ROL[rol]}</p>
        <div className="flex flex-wrap gap-1">
          {PERMISOS_POR_ROL[rol].map((p) => (
            <Badge key={p} tono="neutro">{p}</Badge>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-500">
        El sistema impide dejar sin administrador activo.
      </p>
    </FormularioDialogo>
  );
}

function DialogoClave({ usuario, onCerrar }: { usuario: UsuarioSistema; onCerrar: () => void }) {
  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: restablecerSchema,
    enviar: (datos) =>
      api.post(`/configuracion/usuarios/${usuario.id}/restablecer-clave`, datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Restablecer clave de ${usuario.nombre}`}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Restablecer"
    >
      <Aviso tono="alerta">
        Todas las sesiones abiertas de este usuario se cerrarán. Entréguele la clave nueva por
        un canal seguro y pídale que la cambie.
      </Aviso>

      <Campo
        etiqueta="Contraseña nueva"
        error={errores.password}
        ayuda="Mínimo 10 caracteres, con mayúscula, minúscula y número"
        requerido
      >
        <Entrada name="password" type="password" error={Boolean(errores.password)} autoFocus />
      </Campo>
    </FormularioDialogo>
  );
}

function DialogoEstado({ usuario, onCerrar }: { usuario: UsuarioSistema; onCerrar: () => void }) {
  const activando = !usuario.activo;

  const { enviando, errorGeneral, procesar } = useFormulario({
    schema: cambiarEstadoSchema,
    enviar: (datos) => api.patch(`/configuracion/usuarios/${usuario.id}/estado`, datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={activando ? `Activar a ${usuario.nombre}` : `Desactivar a ${usuario.nombre}`}
      variante={activando ? 'primario' : 'peligro'}
      textoEnviar={activando ? 'Activar' : 'Desactivar'}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar({ activo: activando });
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
    >
      <Aviso tono={activando ? 'marca' : 'alerta'}>
        {activando
          ? 'El usuario podrá volver a iniciar sesión con su clave actual.'
          : 'No podrá iniciar sesión y sus sesiones abiertas se cerrarán de inmediato. Su historial en la auditoría se conserva.'}
      </Aviso>
    </FormularioDialogo>
  );
}
