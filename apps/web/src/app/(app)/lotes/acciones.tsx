'use client';

import { useState } from 'react';
import {
  AREA_MINIMA_M2_POR_DEFECTO, ETIQUETA_ESTADO_LOTE, EstadoLote,
  actualizarLoteSchema, crearLoteSchema, crearLotesEnLoteSchema,
} from '@terranova/shared';
import { api } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { AreaTexto, Boton, Campo, Entrada, EntradaDinero, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { DialogoConfirmar } from '@/components/dialogo';
import { Aviso } from '@/components/ui';
import { IconoMas } from '@/components/iconos';
import type { Lote, ProyectoResumen } from '@/lib/tipos';

interface Etapa { id: string; numero: number; nombre: string }

/* ==========================================================================
   Alta de lotes
   --------------------------------------------------------------------------
   El área es obligatoria y se valida contra el mínimo del proyecto, tanto
   en el esquema compartido como en un trigger de la base. En el v0 el
   formulario solo pedía código y precio, de modo que la regla de los
   1.000 m² del documento original era inaplicable.
   ========================================================================== */

export function BotonesLote({
  proyectos, etapasPorProyecto,
}: { proyectos: ProyectoResumen[]; etapasPorProyecto: Record<string, Etapa[]> }) {
  const [modo, setModo] = useState<'uno' | 'manzana' | null>(null);

  return (
    <>
      <Boton variante="secundario" onClick={() => setModo('manzana')}>
        Crear manzana
      </Boton>
      <Boton onClick={() => setModo('uno')} iconoIzq={<IconoMas className="size-4" />}>
        Nuevo lote
      </Boton>

      {modo === 'uno' && (
        <FormularioLote
          proyectos={proyectos}
          etapasPorProyecto={etapasPorProyecto}
          onCerrar={() => setModo(null)}
        />
      )}
      {modo === 'manzana' && (
        <FormularioManzana
          proyectos={proyectos}
          etapasPorProyecto={etapasPorProyecto}
          onCerrar={() => setModo(null)}
        />
      )}
    </>
  );
}

export function FormularioLote({
  lote, proyectos, etapasPorProyecto, onCerrar,
}: {
  lote?: Lote;
  proyectos: ProyectoResumen[];
  etapasPorProyecto: Record<string, Etapa[]>;
  onCerrar: () => void;
}) {
  const editando = Boolean(lote);
  const [proyectoId, setProyectoId] = useState(
    lote?.proyectoId ?? proyectos[0]?.proyecto_id ?? '',
  );

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: editando ? actualizarLoteSchema : crearLoteSchema,
    enviar: (datos) =>
      editando ? api.patch(`/lotes/${lote!.id}`, datos) : api.post('/lotes', datos),
    alTerminar: onCerrar,
  });

  const etapas = etapasPorProyecto[proyectoId] ?? [];
  const comprometido = lote?.estado === 'VENDIDO' || lote?.estado === 'PAGADO';

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo={editando ? `Editar lote ${lote!.codigo}` : 'Nuevo lote'}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar={editando ? 'Guardar cambios' : 'Crear lote'}
    >
      {comprometido && (
        <Aviso tono="alerta" titulo="Lote comprometido">
          Este lote tiene una venta vigente. Para cambiar su código, área o precio hay que
          anular la venta primero.
        </Aviso>
      )}

      {!editando && (
        <Rejilla>
          <Campo etiqueta="Proyecto" error={errores.proyectoId} requerido>
            <Seleccion
              name="proyectoId"
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              required
            >
              {proyectos.map((p) => (
                <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>
              ))}
            </Seleccion>
          </Campo>

          <Campo etiqueta="Etapa" error={errores.etapaId} ayuda="Opcional">
            <Seleccion name="etapaId" defaultValue="">
              <option value="">Sin etapa</option>
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </Seleccion>
          </Campo>
        </Rejilla>
      )}

      <Rejilla>
        <Campo
          etiqueta="Código del lote"
          error={errores.codigo}
          ayuda="Se normaliza a mayúsculas sin espacios"
          requerido
        >
          <Entrada
            name="codigo"
            placeholder="MZ-A01"
            defaultValue={lote?.codigo}
            disabled={comprometido}
            error={Boolean(errores.codigo)}
            autoFocus={!editando}
          />
        </Campo>

        <Campo
          etiqueta="Área (m²)"
          error={errores.areaM2}
          ayuda={`Mínimo ${AREA_MINIMA_M2_POR_DEFECTO.toLocaleString('es-CO')} m²`}
          requerido
        >
          <Entrada
            name="areaM2"
            inputMode="decimal"
            placeholder="1200"
            defaultValue={lote?.areaM2}
            disabled={comprometido}
            error={Boolean(errores.areaM2)}
            className="tabular text-right"
          />
        </Campo>
      </Rejilla>

      <Campo etiqueta="Precio de lista" error={errores.precioLista} requerido>
        <EntradaDinero
          name="precioLista"
          defaultValue={lote?.precioLista}
          disabled={comprometido}
          error={Boolean(errores.precioLista)}
        />
      </Campo>

      {editando && !comprometido && (
        <Campo
          etiqueta="Estado"
          error={errores.estado}
          ayuda="Para VENDIDO o PAGADO, registre la venta correspondiente"
        >
          <Seleccion name="estado" defaultValue={lote!.estado}>
            {(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO'] as const).map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_LOTE[e as EstadoLote]}</option>
            ))}
          </Seleccion>
        </Campo>
      )}

      <Campo etiqueta="Observaciones" error={errores.observaciones}>
        <AreaTexto name="observaciones" rows={2} defaultValue={lote?.observaciones ?? ''} />
      </Campo>
    </FormularioDialogo>
  );
}

/* --- Creación masiva ------------------------------------------------------ */

/**
 * Crea una manzana completa a partir de un rango. El v0 obligaba a
 * capturar los lotes uno por uno; cargar un proyecto de 200 lotes era
 * una tarde de digitación.
 */
export function FormularioManzana({
  proyectos, etapasPorProyecto, onCerrar,
}: {
  proyectos: ProyectoResumen[];
  etapasPorProyecto: Record<string, Etapa[]>;
  onCerrar: () => void;
}) {
  const [proyectoId, setProyectoId] = useState(proyectos[0]?.proyecto_id ?? '');
  const [prefijo, setPrefijo] = useState('MZ-A');
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('10');
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: crearLotesEnLoteSchema,
    enviar: async (datos) => {
      const r = await api.post<{ creados: number; omitidos: number }>('/lotes/en-lote', datos);
      setResultado(r);
      return r;
    },
  });

  const cantidad = Math.max(0, (Number(hasta) || 0) - (Number(desde) || 0) + 1);
  const etapas = etapasPorProyecto[proyectoId] ?? [];

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo="Crear manzana completa"
      descripcion="Genera todos los lotes de un rango con la misma área y precio. Los que ya existan se omiten."
      onEnviar={(e) => {
        e.preventDefault();
        void procesar(datosDelFormulario(e.currentTarget));
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar={cantidad > 0 ? `Crear ${cantidad} lote(s)` : 'Crear lotes'}
    >
      {resultado && (
        <Aviso tono="exito" titulo="Lotes creados">
          Se crearon {resultado.creados} lote(s).
          {resultado.omitidos > 0 && ` Se omitieron ${resultado.omitidos} por código duplicado.`}
        </Aviso>
      )}

      <Rejilla>
        <Campo etiqueta="Proyecto" error={errores.proyectoId} requerido>
          <Seleccion
            name="proyectoId"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            required
          >
            {proyectos.map((p) => (
              <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Etapa" error={errores.etapaId} ayuda="Opcional">
          <Seleccion name="etapaId" defaultValue="">
            <option value="">Sin etapa</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </Seleccion>
        </Campo>
      </Rejilla>

      <Rejilla cols={3}>
        <Campo etiqueta="Prefijo" error={errores.prefijo} requerido>
          <Entrada
            name="prefijo"
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value)}
            placeholder="MZ-A"
            error={Boolean(errores.prefijo)}
          />
        </Campo>

        <Campo etiqueta="Desde" error={errores.desde} requerido>
          <Entrada
            name="desde"
            inputMode="numeric"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="tabular text-right"
            error={Boolean(errores.desde)}
          />
        </Campo>

        <Campo etiqueta="Hasta" error={errores.hasta} requerido>
          <Entrada
            name="hasta"
            inputMode="numeric"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="tabular text-right"
            error={Boolean(errores.hasta)}
          />
        </Campo>
      </Rejilla>

      {cantidad > 0 && (
        <p className="rounded-[--radius-control] bg-brand-50 px-3.5 py-2.5 text-xs text-brand-900">
          Se crearán <strong className="tabular">{cantidad}</strong> lotes:{' '}
          <span className="font-mono">
            {prefijo.toUpperCase()}
            {String(desde).padStart(2, '0')}
          </span>{' '}
          …{' '}
          <span className="font-mono">
            {prefijo.toUpperCase()}
            {String(hasta).padStart(2, '0')}
          </span>
        </p>
      )}

      <Rejilla>
        <Campo
          etiqueta="Área de cada lote (m²)"
          error={errores.areaM2}
          ayuda={`Mínimo ${AREA_MINIMA_M2_POR_DEFECTO.toLocaleString('es-CO')} m²`}
          requerido
        >
          <Entrada
            name="areaM2"
            inputMode="decimal"
            placeholder="1200"
            className="tabular text-right"
            error={Boolean(errores.areaM2)}
          />
        </Campo>

        <Campo etiqueta="Precio de lista" error={errores.precioLista} requerido>
          <EntradaDinero name="precioLista" error={Boolean(errores.precioLista)} />
        </Campo>
      </Rejilla>
    </FormularioDialogo>
  );
}

/* --- Acciones por fila ---------------------------------------------------- */

export function AccionesLote({
  lote, proyectos, etapasPorProyecto,
}: {
  lote: Lote;
  proyectos: ProyectoResumen[];
  etapasPorProyecto: Record<string, Etapa[]>;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comprometido = lote.estado === 'VENDIDO' || lote.estado === 'PAGADO';

  async function eliminar() {
    setBorrando(true);
    setError(null);
    try {
      await api.delete(`/lotes/${lote.id}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el lote.');
      setBorrando(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(true)}>
        Editar
      </Boton>
      {!comprometido && (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => setConfirmando(true)}
          className="text-danger-600 hover:bg-danger-50"
        >
          Eliminar
        </Boton>
      )}

      {editando && (
        <FormularioLote
          lote={lote}
          proyectos={proyectos}
          etapasPorProyecto={etapasPorProyecto}
          onCerrar={() => setEditando(false)}
        />
      )}

      <DialogoConfirmar
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        onConfirmar={eliminar}
        cargando={borrando}
        titulo={`Eliminar lote ${lote.codigo}`}
        textoConfirmar="Eliminar"
        descripcion="Esta acción no se puede deshacer. Si el lote tiene historial de ventas, el sistema lo impedirá."
      >
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </DialogoConfirmar>
    </div>
  );
}
