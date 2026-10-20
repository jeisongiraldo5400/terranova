'use client';

import type { ReactNode } from 'react';
import { Boton } from './controles';
import { Dialogo } from './dialogo';
import { Aviso } from './ui';

/**
 * Envoltorio de formulario dentro de un diálogo. Centraliza el aviso de
 * error general, el pie con los botones y el estado de envío, que son
 * idénticos en los diez formularios del sistema.
 */
export function FormularioDialogo({
  abierto, onCerrar, titulo, descripcion, onEnviar, enviando, errorGeneral,
  textoEnviar = 'Guardar', variante = 'primario', ancho = 'md', children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  onEnviar: (e: React.FormEvent<HTMLFormElement>) => void;
  enviando: boolean;
  errorGeneral: string | null;
  textoEnviar?: string;
  variante?: 'primario' | 'peligro';
  ancho?: 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      ancho={ancho}
    >
      <form onSubmit={onEnviar} className="space-y-4" noValidate>
        {errorGeneral && <Aviso tono="peligro">{errorGeneral}</Aviso>}

        {children}

        <div className="flex justify-end gap-2 border-t border-muted-200 pt-4">
          <Boton variante="secundario" type="button" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" variante={variante} cargando={enviando}>
            {textoEnviar}
          </Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/** Rejilla de dos columnas que colapsa en móvil. */
export function Rejilla({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const clases = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };
  return <div className={`grid gap-4 ${clases[cols]}`}>{children}</div>;
}
