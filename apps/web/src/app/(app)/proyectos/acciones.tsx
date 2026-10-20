'use client';

import { useState } from 'react';
import {
  AREA_MINIMA_M2_POR_DEFECTO, EstadoProyecto,
  actualizarProyectoSchema, crearEtapaSchema, crearProyectoSchema,
} from '@terranova/shared';
import { api } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { AreaTexto, Boton, Campo, Entrada, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { Aviso } from '@/components/ui';
import { IconoMas } from '@/components/iconos';
import type { Proyecto, ProyectoResumen } from '@/lib/tipos';

const ETIQUETA_ESTADO: Record<string, string> = {
  ACTIVO: 'Activo',
  PAUSADO: 'Pausado',
  CERRADO: 'Cerrado',
};

export function BotonNuevoProyecto() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton onClick={() => setAbierto(true)} iconoIzq={<IconoMas className="size-4" />}>
        Nuevo proyecto
      </Boton>
      {abierto && <FormularioProyecto onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function FormularioProyecto({
  proyecto, onCerrar,
}: { proyecto?: Proyecto; onCerrar: () => void }) {
  const editando = Boolean(proyecto);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: editando ? actualizarProyectoSchema : crearProyectoSchema,
    enviar: (datos) =>
      editando ? api.patch(`/proyectos/${proyecto!.id}`, datos) : api.post('/proyectos', datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={editando ? `Editar ${proyecto!.nombre}` : 'Nuevo proyecto'}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar={editando ? 'Guardar cambios' : 'Crear proyecto'}
    >
      <Rejilla>
        {!editando && (
          <Campo
            etiqueta="Código"
            error={errores.codigo}
            ayuda="Identificador corto, sin espacios"
            requerido
          >
            <Entrada name="codigo" placeholder="TERRANOVA-1" error={Boolean(errores.codigo)} autoFocus />
          </Campo>
        )}

        <Campo etiqueta="Estado" error={errores.estado}>
          <Seleccion name="estado" defaultValue={proyecto?.estado ?? EstadoProyecto.ACTIVO}>
            {Object.values(EstadoProyecto).map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>
            ))}
          </Seleccion>
        </Campo>
      </Rejilla>

      <Campo etiqueta="Nombre" error={errores.nombre} requerido>
        <Entrada
          name="nombre"
          placeholder="Terranova Etapa Norte"
          defaultValue={proyecto?.nombre}
          error={Boolean(errores.nombre)}
          autoFocus={editando}
        />
      </Campo>

      <Campo etiqueta="Ubicación" error={errores.ubicacion}>
        <Entrada
          name="ubicacion"
          placeholder="Vereda El Cerrito, Montería"
          defaultValue={proyecto?.ubicacion ?? ''}
        />
      </Campo>

      <Campo
        etiqueta="Área mínima por lote (m²)"
        error={errores.areaMinimaM2}
        ayuda="La regla del documento original es 1.000 m². Subirla no puede dejar lotes existentes por debajo."
      >
        <Entrada
          name="areaMinimaM2"
          inputMode="decimal"
          defaultValue={proyecto?.areaMinimaM2 ?? String(AREA_MINIMA_M2_POR_DEFECTO)}
          className="tabular text-right"
          error={Boolean(errores.areaMinimaM2)}
        />
      </Campo>

      <Campo etiqueta="Observaciones" error={errores.observaciones}>
        <AreaTexto name="observaciones" rows={2} defaultValue={proyecto?.observaciones ?? ''} />
      </Campo>
    </FormularioDialogo>
  );
}

/* --- Etapas --------------------------------------------------------------- */

function FormularioEtapa({
  proyecto, onCerrar,
}: { proyecto: Proyecto; onCerrar: () => void }) {
  const siguiente = Math.max(0, ...proyecto.etapas.map((e) => e.numero)) + 1;

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: crearEtapaSchema,
    enviar: (datos) => api.post('/proyectos/etapas', datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Nueva etapa en ${proyecto.nombre}`}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar({ ...datosDelFormulario(e.currentTarget), proyectoId: proyecto.id });
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Crear etapa"
    >
      {proyecto.etapas.length > 0 && (
        <p className="text-xs text-muted-500">
          Etapas actuales: {proyecto.etapas.map((e) => e.nombre).join(', ')}
        </p>
      )}

      <Rejilla>
        <Campo etiqueta="Número" error={errores.numero} requerido>
          <Entrada
            name="numero"
            inputMode="numeric"
            defaultValue={String(siguiente)}
            className="tabular text-right"
            error={Boolean(errores.numero)}
          />
        </Campo>

        <Campo etiqueta="Nombre" error={errores.nombre} requerido>
          <Entrada
            name="nombre"
            placeholder={`Etapa ${siguiente}`}
            error={Boolean(errores.nombre)}
            autoFocus
          />
        </Campo>
      </Rejilla>
    </FormularioDialogo>
  );
}

/* --- Acciones por tarjeta -------------------------------------------------- */

export function AccionesProyecto({
  resumen, detalle,
}: { resumen: ProyectoResumen; detalle: Proyecto }) {
  const [dialogo, setDialogo] = useState<'editar' | 'etapa' | 'eliminar' | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comprometidos =
    resumen.lotes_vendidos + resumen.lotes_pagados + resumen.lotes_reservados;

  async function eliminar() {
    setBorrando(true);
    setError(null);
    try {
      await api.delete(`/proyectos/${resumen.proyecto_id}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el proyecto.');
      setBorrando(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1 border-t border-muted-200/70 px-3 py-2">
      <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo('editar')}>
        Editar
      </Boton>
      <Boton variante="fantasma" tamano="sm" onClick={() => setDialogo('etapa')}>
        Añadir etapa
      </Boton>
      {comprometidos === 0 && (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => setDialogo('eliminar')}
          className="text-danger-600 hover:bg-danger-50"
        >
          Eliminar
        </Boton>
      )}

      {dialogo === 'editar' && (
        <FormularioProyecto proyecto={detalle} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === 'etapa' && (
        <FormularioEtapa proyecto={detalle} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === 'eliminar' && (
        <FormularioDialogo
          abierto
          onCerrar={() => setDialogo(null)}
          titulo={`Eliminar ${resumen.nombre}`}
          variante="peligro"
          textoEnviar="Eliminar proyecto"
          enviando={borrando}
          errorGeneral={error}
          onEnviar={(e) => {
            e.preventDefault();
            void eliminar();
          }}
        >
          <Aviso tono="peligro">
            Se eliminarán también sus {resumen.total_lotes} lote(s). Un proyecto con lotes
            vendidos, pagados o reservados no se puede eliminar: ciérrelo cambiando su estado.
          </Aviso>
        </FormularioDialogo>
      )}
    </div>
  );
}
