'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Boton } from './controles';

/**
 * Dialogo accesible sobre <dialog> nativo. Reemplaza los window.confirm()
 * y alert() del v0 (11 usos), que bloquean el hilo, no se pueden estilar y
 * no dan contexto de lo que se esta por hacer.
 */
export function Dialogo({
  abierto, onCerrar, titulo, descripcion, children, pie,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children?: ReactNode;
  pie?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        // Cerrar al pulsar fuera del panel.
        if (e.target === ref.current) onCerrar();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[--radius-card] p-0 shadow-[--shadow-overlay] backdrop:bg-ink-900/40"
      aria-labelledby="titulo-dialogo"
    >
      <div className="border-b border-muted-200 px-5 py-4">
        <h2 id="titulo-dialogo" className="text-base font-semibold text-ink-900">
          {titulo}
        </h2>
        {descripcion && <p className="mt-1 text-sm text-muted-600">{descripcion}</p>}
      </div>
      {children && <div className="px-5 py-4">{children}</div>}
      {pie && (
        <div className="flex justify-end gap-2 border-t border-muted-200 bg-muted-100 px-5 py-3">
          {pie}
        </div>
      )}
    </dialog>
  );
}

/** Confirmacion de una accion destructiva, con su consecuencia explicita. */
export function DialogoConfirmar({
  abierto, onCerrar, onConfirmar, titulo, descripcion, textoConfirmar = 'Confirmar',
  cargando = false, variante = 'peligro', children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
  titulo: string;
  descripcion?: string;
  textoConfirmar?: string;
  cargando?: boolean;
  variante?: 'peligro' | 'primario';
  children?: ReactNode;
}) {
  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={variante} onClick={onConfirmar} cargando={cargando}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      {children}
    </Dialogo>
  );
}
