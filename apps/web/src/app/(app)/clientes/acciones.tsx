'use client';

import { useState } from 'react';
import {
  ETIQUETA_TIPO_DOCUMENTO, TipoDocumento, actualizarClienteSchema, crearClienteSchema,
} from '@terranova/shared';
import { api } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { AreaTexto, Boton, Campo, Entrada, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { DialogoConfirmar } from '@/components/dialogo';
import { IconoMas } from '@/components/iconos';
import type { Cliente } from '@/lib/tipos';

/* ==========================================================================
   Alta y edición de clientes
   --------------------------------------------------------------------------
   El documento se normaliza en el esquema compartido: "1.234.567" y
   "1234567" son la misma persona. El v0 los trataba como dos clientes
   distintos, cada uno con su propio saldo.
   ========================================================================== */

export function BotonNuevoCliente() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Boton onClick={() => setAbierto(true)} iconoIzq={<IconoMas className="size-4" />}>
        Nuevo cliente
      </Boton>
      {abierto && <FormularioCliente onCerrar={() => setAbierto(false)} />}
    </>
  );
}

export function FormularioCliente({
  cliente, onCerrar,
}: { cliente?: Cliente; onCerrar: () => void }) {
  const editando = Boolean(cliente);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: editando ? actualizarClienteSchema : crearClienteSchema,
    enviar: (datos) =>
      editando ? api.patch(`/clientes/${cliente!.id}`, datos) : api.post('/clientes', datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={editando ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion={
        editando
          ? undefined
          : 'El documento identifica al cliente en todos los proyectos. Si ya existe, el sistema lo avisará.'
      }
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar={editando ? 'Guardar cambios' : 'Crear cliente'}
    >
      <Rejilla>
        <Campo etiqueta="Tipo de documento" error={errores.tipoDocumento} requerido>
          <Seleccion name="tipoDocumento" defaultValue={cliente?.tipoDocumento ?? TipoDocumento.CC}>
            {Object.values(TipoDocumento).map((t) => (
              <option key={t} value={t}>{ETIQUETA_TIPO_DOCUMENTO[t]}</option>
            ))}
          </Seleccion>
        </Campo>

        <Campo
          etiqueta="Documento"
          error={errores.documento}
          ayuda="Los puntos y guiones se ignoran"
          requerido
        >
          <Entrada
            name="documento"
            inputMode="numeric"
            placeholder="1.234.567.890"
            defaultValue={cliente?.documento}
            error={Boolean(errores.documento)}
            autoFocus={!editando}
          />
        </Campo>
      </Rejilla>

      <Campo etiqueta="Nombre completo" error={errores.nombre} requerido>
        <Entrada
          name="nombre"
          placeholder="José Manuel Pérez Díaz"
          defaultValue={cliente?.nombre}
          error={Boolean(errores.nombre)}
        />
      </Campo>

      <Rejilla>
        <Campo etiqueta="Teléfono" error={errores.telefono} requerido>
          <Entrada
            name="telefono"
            inputMode="tel"
            placeholder="3104567890"
            defaultValue={cliente?.telefono}
            error={Boolean(errores.telefono)}
          />
        </Campo>

        <Campo etiqueta="Correo electrónico" error={errores.email}>
          <Entrada
            name="email"
            type="email"
            placeholder="cliente@correo.co"
            defaultValue={cliente?.email ?? ''}
            error={Boolean(errores.email)}
          />
        </Campo>

        <Campo etiqueta="Dirección" error={errores.direccion}>
          <Entrada name="direccion" defaultValue={cliente?.direccion ?? ''} />
        </Campo>

        <Campo etiqueta="Ciudad" error={errores.ciudad}>
          <Entrada name="ciudad" placeholder="Montería" defaultValue={cliente?.ciudad ?? ''} />
        </Campo>
      </Rejilla>

      <Campo etiqueta="Observaciones" error={errores.observaciones}>
        <AreaTexto name="observaciones" rows={2} defaultValue={cliente?.observaciones ?? ''} />
      </Campo>
    </FormularioDialogo>
  );
}

/* --- Acciones por fila ---------------------------------------------------- */

export function AccionesCliente({ cliente }: { cliente: Cliente }) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conVentas = (cliente._count?.ventas ?? 0) > 0;

  async function cambiarEstado() {
    setTrabajando(true);
    setError(null);
    try {
      await api.post(`/clientes/${cliente.id}/${cliente.activo ? 'desactivar' : 'reactivar'}`);
      setConfirmando(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(true)}>
        Editar
      </Boton>
      <Boton
        variante="fantasma"
        tamano="sm"
        onClick={() => setConfirmando(true)}
        className={cliente.activo ? 'text-muted-500 hover:bg-muted-100' : ''}
      >
        {cliente.activo ? 'Desactivar' : 'Reactivar'}
      </Boton>

      {editando && <FormularioCliente cliente={cliente} onCerrar={() => setEditando(false)} />}

      <DialogoConfirmar
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        onConfirmar={cambiarEstado}
        cargando={trabajando}
        variante={cliente.activo ? 'peligro' : 'primario'}
        titulo={cliente.activo ? 'Desactivar cliente' : 'Reactivar cliente'}
        textoConfirmar={cliente.activo ? 'Desactivar' : 'Reactivar'}
        descripcion={
          cliente.activo
            ? `${cliente.nombre} no podrá realizar compras nuevas. Su historial y su cartera se conservan.`
            : `${cliente.nombre} volverá a poder realizar compras.`
        }
      >
        {error && <p className="text-sm text-danger-600">{error}</p>}
        {cliente.activo && conVentas && (
          <p className="text-sm text-muted-600">
            Tiene {cliente._count?.ventas} venta(s) vigente(s), que seguirán activas.
          </p>
        )}
      </DialogoConfirmar>
    </div>
  );
}
