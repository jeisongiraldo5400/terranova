/* ==========================================================================
   Iconografia
   --------------------------------------------------------------------------
   SVG trazados a mano, sin dependencias. Un solo grosor de linea (1.5) y la
   misma caja de 24 para que todos pesen igual en pantalla; mezclar grosores
   es lo que hace que un conjunto de iconos se vea improvisado.

   Reemplazan los glifos unicode del v0 (◱ ◫ ▦ ◐ ◈), que dependian de la
   fuente del sistema y se veian distintos en cada equipo.
   ========================================================================== */

import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...resto }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      {children}
    </svg>
  );
}

/* --- Navegacion ---------------------------------------------------------- */

export const IconoTablero = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
  </Base>
);

export const IconoProyectos = (p: Props) => (
  <Base {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9.5 21v-5h5v5" />
    <path d="M9.5 10.5h1M13.5 10.5h1" />
  </Base>
);

export const IconoLotes = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9.5h18M3 15h18M9.5 3v18M15 3v18" />
  </Base>
);

export const IconoClientes = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.5a3.25 3.25 0 0 1 0 6.3" />
    <path d="M18 14.6a6.5 6.5 0 0 1 3.5 5.4" />
  </Base>
);

export const IconoVentas = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </Base>
);

export const IconoPagos = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19" />
    <path d="M6.5 14.5h3" />
  </Base>
);

export const IconoContratos = (p: Props) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 16.5h4.5" />
  </Base>
);

export const IconoReportes = (p: Props) => (
  <Base {...p}>
    <path d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21" />
    <path d="M7 15.5v2.5M11.5 10v8M16 12.5v5.5M20.5 6.5V18" />
  </Base>
);

export const IconoConfiguracion = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5.6 7.9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Base>
);

export const IconoAuditoria = (p: Props) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m9 14 1.8 1.8L14.5 12" />
  </Base>
);

/* --- Indicadores --------------------------------------------------------- */

export const IconoDinero = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.2A2.8 2.8 0 0 0 12 7.8c-1.5 0-2.6.9-2.6 2.1 0 2.8 5.4 1.5 5.4 4.3 0 1.2-1.2 2.1-2.8 2.1a2.9 2.9 0 0 1-2.6-1.5" />
    <path d="M12 6.2v11.6" />
  </Base>
);

export const IconoRecaudo = (p: Props) => (
  <Base {...p}>
    <path d="M3 16.5 9 10l4 3.5 7.5-8" />
    <path d="M15.5 5.5h5v5" />
  </Base>
);

export const IconoPorCobrar = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6.8V12l3.4 2" />
  </Base>
);

export const IconoMora = (p: Props) => (
  <Base {...p}>
    <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0" />
    <path d="M12 9.5v4M12 17h.01" />
  </Base>
);

/* --- Acciones ------------------------------------------------------------ */

export const IconoBuscar = (p: Props) => (
  <Base {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.9-4.9" />
  </Base>
);

export const IconoDescargar = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.5v11" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M4.5 19.5h15" />
  </Base>
);

export const IconoMas = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconoFlecha = (p: Props) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconoAtras = (p: Props) => (
  <Base {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
);

export const IconoSalir = (p: Props) => (
  <Base {...p}>
    <path d="M9.5 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 16 4-4-4-4M20 12H9.5" />
  </Base>
);

export const IconoMenu = (p: Props) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const IconoCerrar = (p: Props) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const IconoCorreo = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3.5 7 7.4 5.2a2 2 0 0 0 2.2 0L20.5 7" />
  </Base>
);

export const IconoClave = (p: Props) => (
  <Base {...p}>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Base>
);

export const IconoVerificado = (p: Props) => (
  <Base {...p}>
    <path d="M20 6.5 9.5 17 4 11.5" />
  </Base>
);

export const IconoVacio = (p: Props) => (
  <Base {...p}>
    <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" strokeDasharray="3 3" />
    <path d="M12 12v4.5M12 8.5h.01" />
  </Base>
);

/* --- Marca --------------------------------------------------------------- */

/**
 * Marca de TERRANOVA: un lote visto en planta, con el trazo diagonal que
 * sugiere el terreno. Funciona a 20 px y a 80 px sin perder legibilidad.
 *
 * `sobreOscuro` aclara la rampa: el azul de marca sobre el navy del menu
 * lateral queda casi invisible, de modo que alli se usa una version mas
 * luminosa en lugar de repetir el mismo degradado.
 */
export function Logo({
  className = 'size-9',
  sobreOscuro = false,
}: { className?: string; sobreOscuro?: boolean }) {
  const id = sobreOscuro ? 'logo-terranova-claro' : 'logo-terranova';
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={sobreOscuro ? '#93c5fd' : '#60a5fa'} />
          <stop offset="55%" stopColor={sobreOscuro ? '#3b82f6' : '#2563eb'} />
          <stop offset="100%" stopColor={sobreOscuro ? '#2563eb' : '#1e3a8a'} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id})`} />
      <path
        d="M11 25.5 20 11l9 14.5"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 29.5h18" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
