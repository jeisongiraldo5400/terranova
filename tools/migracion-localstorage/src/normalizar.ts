/* ==========================================================================
   Normalizacion de los datos heredados
   --------------------------------------------------------------------------
   El sistema v0 dejo los datos repartidos entre dos generaciones de claves
   incompatibles:

     clientes:  "clientes_por_proyecto"  vs  "clientesPorProyecto"
     lotes:     "lotes" (arreglo plano)  vs  "lotesPorProyecto" (por proyecto)
     ventas:    la clave "ventas" NUNCA se escribio desde pages/Ventas.jsx

   Ademas los clientes no tenian id, los lotes no tenian area y el saldo se
   guardaba duplicado en varios sitios. Este modulo reconstruye un modelo
   coherente y reporta todo lo que no pudo resolver.
   ========================================================================== */

import {
  AREA_MINIMA_M2_POR_DEFECTO,
  type Dinero,
  dinero,
  dineroDesdeTexto,
  normalizarDocumento,
} from '@terranova/shared';

export interface Incidencia {
  nivel: 'aviso' | 'error';
  entidad: string;
  detalle: string;
  datos?: unknown;
}

export interface ClienteNormalizado {
  documento: string;
  nombre: string;
  telefono: string;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  observaciones: string | null;
  /** Claves con las que aparecia en el v0, para enlazar ventas. */
  alias: string[];
}

export interface LoteNormalizado {
  claveOriginal: string;
  proyectoCodigo: string;
  codigo: string;
  areaM2: number;
  precioLista: Dinero;
  estado: 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'PAGADO';
  /** Documento del comprador, si el lote estaba vendido. */
  compradorDocumento: string | null;
  fechaVenta: Date | null;
  areaInferida: boolean;
}

export interface VentaNormalizada {
  loteClave: string;
  compradorDocumento: string;
  precioNegociado: Dinero;
  fechaVenta: Date;
  /** true cuando la venta no existia y se dedujo del estado del lote. */
  reconstruida: boolean;
}

export interface PagoNormalizado {
  loteClave: string;
  monto: Dinero;
  fecha: Date;
  tipo: 'CUOTA_INICIAL' | 'ABONO' | 'PAGO_FINAL';
  concepto: string | null;
}

export interface ProyectoNormalizado {
  codigo: string;
  nombre: string;
  estado: 'ACTIVO' | 'PAUSADO' | 'CERRADO';
}

export interface ResultadoNormalizacion {
  proyectos: ProyectoNormalizado[];
  clientes: ClienteNormalizado[];
  lotes: LoteNormalizado[];
  ventas: VentaNormalizada[];
  pagos: PagoNormalizado[];
  incidencias: Incidencia[];
}

type Json = Record<string, unknown>;

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Codigo canonico de proyecto. Debe aplicarse por igual al crear el
 * proyecto y al referenciarlo desde un lote: normalizar en un solo lado
 * hacia que "casas-1" no encontrara a "CASAS-1" y todos los lotes
 * terminaran en el proyecto de respaldo.
 */
const codigoProyecto = (v: unknown): string =>
  texto(v).toUpperCase().replace(/\s+/g, '-').slice(0, 30);

/** Acepta number, "85000000" o "85.000.000"; devuelve cero si no se puede leer. */
function leerDinero(v: unknown, incidencias: Incidencia[], contexto: string): Dinero {
  if (v === null || v === undefined || v === '') return dinero(0);
  try {
    return typeof v === 'number' ? dinero(v) : dineroDesdeTexto(String(v));
  } catch {
    incidencias.push({
      nivel: 'aviso',
      entidad: contexto,
      detalle: `Valor monetario ilegible, se tomo cero: ${JSON.stringify(v)}`,
    });
    return dinero(0);
  }
}

function leerFecha(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v);
  // "2026-01-20" o ISO completo. Siempre como dia calendario UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? null
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const normalizarEstadoLote = (v: unknown): 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'PAGADO' => {
  const s = texto(v).toLowerCase();
  if (s === 'vendido') return 'VENDIDO';
  if (s === 'reservado') return 'RESERVADO';
  if (s === 'pagado') return 'PAGADO';
  return 'DISPONIBLE';
};

export function normalizar(exportado: Json): ResultadoNormalizacion {
  const datos = (exportado.datos ?? exportado) as Json;
  const incidencias: Incidencia[] = [];

  /* --- Proyectos ------------------------------------------------------- */
  const proyectosCrudos = Array.isArray(datos.proyectos) ? (datos.proyectos as Json[]) : [];
  const proyectos: ProyectoNormalizado[] = proyectosCrudos.map((p) => ({
    codigo: codigoProyecto(texto(p.id) || texto(p.nombre)),
    nombre: texto(p.nombre) || texto(p.id),
    estado: texto(p.estado).toLowerCase() === 'inactivo' ? 'PAUSADO' : 'ACTIVO',
  }));

  /* --- Clientes: se unen las DOS claves desalineadas ------------------- */
  // Un mismo comprador pudo quedar en ambas con datos distintos; se funden
  // por documento normalizado ("1.234.567" y "1234567" son el mismo).
  const porDocumento = new Map<string, ClienteNormalizado>();

  for (const clave of ['clientes_por_proyecto', 'clientesPorProyecto']) {
    const base = datos[clave];
    if (!base || typeof base !== 'object') continue;

    for (const [proyectoId, lista] of Object.entries(base as Json)) {
      if (!Array.isArray(lista)) continue;

      for (const c of lista as Json[]) {
        const documentoCrudo = texto(c.cedula) || texto(c.documento) || texto(c.nit);
        if (!documentoCrudo) {
          incidencias.push({
            nivel: 'error',
            entidad: 'Cliente',
            detalle: `Cliente sin documento en el proyecto "${proyectoId}" (clave ${clave}). Se omite.`,
            datos: c,
          });
          continue;
        }

        const documento = normalizarDocumento(documentoCrudo);
        const existente = porDocumento.get(documento);
        const alias = `${proyectoId}::${texto(c.nombre)}`;

        if (existente) {
          // Conflicto entre las dos generaciones de datos.
          if (existente.nombre !== texto(c.nombre) && texto(c.nombre)) {
            incidencias.push({
              nivel: 'aviso',
              entidad: 'Cliente',
              detalle:
                `El documento ${documento} aparece con dos nombres: ` +
                `"${existente.nombre}" y "${texto(c.nombre)}". Se conserva el primero.`,
            });
          }
          if (!existente.alias.includes(alias)) existente.alias.push(alias);
          existente.telefono ||= texto(c.telefono);
          existente.email ||= texto(c.correo) || texto(c.email) || null;
          existente.direccion ||= texto(c.direccion) || null;
          existente.ciudad ||= texto(c.ciudad) || null;
          continue;
        }

        porDocumento.set(documento, {
          documento,
          nombre: texto(c.nombre) || `Cliente ${documento}`,
          telefono: texto(c.telefono) || '0000000',
          email: texto(c.correo) || texto(c.email) || null,
          direccion: texto(c.direccion) || null,
          ciudad: texto(c.ciudad) || null,
          observaciones: texto(c.observaciones) || null,
          alias: [alias],
        });
      }
    }
  }

  const clientes = [...porDocumento.values()];

  /* --- Lotes: se unen el arreglo plano y el mapa por proyecto ---------- */
  const lotesPorClave = new Map<string, LoteNormalizado>();

  const registrarLote = (l: Json, proyectoCodigo: string) => {
    const codigo = (texto(l.codigo) || texto(l.nombre) || texto(l.id))
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!codigo) {
      incidencias.push({
        nivel: 'error',
        entidad: 'Lote',
        detalle: 'Lote sin codigo identificable. Se omite.',
        datos: l,
      });
      return;
    }

    const clave = `${proyectoCodigo}::${codigo}`;

    // El v0 no tenia campo de area: no hay dato que migrar. Se marca con el
    // minimo legal y queda señalado para revision manual.
    const areaCruda = Number(l.areaM2 ?? l.area ?? 0);
    const areaInferida = !Number.isFinite(areaCruda) || areaCruda <= 0;
    const areaM2 = areaInferida ? AREA_MINIMA_M2_POR_DEFECTO : areaCruda;

    if (areaInferida) {
      incidencias.push({
        nivel: 'aviso',
        entidad: 'Lote',
        detalle:
          `El lote ${clave} no tiene area (el sistema anterior no la registraba). ` +
          `Se asigno el minimo de ${AREA_MINIMA_M2_POR_DEFECTO} m2; verifiquelo.`,
      });
    }

    const precio = leerDinero(l.precio ?? l.valor, incidencias, `Lote ${clave}`);
    if (precio.isZero()) {
      incidencias.push({
        nivel: 'aviso',
        entidad: 'Lote',
        detalle:
          `El lote ${clave} no tiene precio en el sistema anterior. Se importara con ` +
          'un valor simbolico de $1 porque la base exige precio positivo; corrijalo.',
      });
    }
    const estado = normalizarEstadoLote(l.estado);

    const existente = lotesPorClave.get(clave);
    if (existente) {
      // Gana el registro con mas informacion.
      if (existente.estado === 'DISPONIBLE' && estado !== 'DISPONIBLE') {
        existente.estado = estado;
        existente.fechaVenta = leerFecha(l.fechaVenta);
      }
      if (existente.precioLista.isZero() && !precio.isZero()) existente.precioLista = precio;
      return;
    }

    lotesPorClave.set(clave, {
      claveOriginal: clave,
      proyectoCodigo,
      codigo,
      areaM2,
      precioLista: precio,
      estado,
      compradorDocumento: texto(l.clienteCedula) || texto(l.cliente) || null,
      fechaVenta: leerFecha(l.fechaVenta),
      areaInferida,
    });
  };

  if (Array.isArray(datos.lotes)) {
    for (const l of datos.lotes as Json[]) {
      registrarLote(l, codigoProyecto(l.projectId) || 'SIN-PROYECTO');
    }
  }

  if (datos.lotesPorProyecto && typeof datos.lotesPorProyecto === 'object') {
    for (const [proyectoId, lista] of Object.entries(datos.lotesPorProyecto as Json)) {
      if (!Array.isArray(lista)) continue;
      for (const l of lista as Json[]) registrarLote(l, codigoProyecto(proyectoId));
    }
  }

  const lotes = [...lotesPorClave.values()];

  /* --- Ventas: la parte que hay que RECONSTRUIR ------------------------ */
  // pages/Ventas.jsx nunca escribio la clave `ventas`: lo unico que quedo
  // del acto de vender es el estado del lote y su fechaVenta.
  const ventas: VentaNormalizada[] = [];
  const ventasCrudas = datos.ventas;
  const vistas = new Set<string>();

  if (ventasCrudas && typeof ventasCrudas === 'object') {
    for (const [, lista] of Object.entries(ventasCrudas as Json)) {
      if (!Array.isArray(lista)) continue;
      for (const v of lista as Json[]) {
        const doc = normalizarDocumento(texto(v.clienteCedula) || texto(v.clienteDocumento));
        const loteCodigo = texto(v.loteCodigo).toUpperCase();
        const lote = lotes.find((l) => l.codigo === loteCodigo);
        if (!lote || !doc) {
          incidencias.push({
            nivel: 'error',
            entidad: 'Venta',
            detalle: `Venta sin lote o cliente identificable (lote "${loteCodigo}", doc "${doc}"). Se omite.`,
            datos: v,
          });
          continue;
        }
        const fecha = leerFecha(v.fecha ?? v.fechaVenta) ?? new Date();
        ventas.push({
          loteClave: lote.claveOriginal,
          compradorDocumento: doc,
          precioNegociado: leerDinero(v.precio ?? v.valor, incidencias, `Venta ${loteCodigo}`),
          fechaVenta: fecha,
          reconstruida: false,
        });
        vistas.add(lote.claveOriginal);
      }
    }
  }

  // Lotes vendidos sin venta registrada: se deduce la venta.
  for (const lote of lotes) {
    if (lote.estado !== 'VENDIDO' && lote.estado !== 'PAGADO') continue;
    if (vistas.has(lote.claveOriginal)) continue;

    const doc = lote.compradorDocumento ? normalizarDocumento(lote.compradorDocumento) : null;
    if (!doc || !porDocumento.has(doc)) {
      incidencias.push({
        nivel: 'error',
        entidad: 'Venta',
        detalle:
          `El lote ${lote.claveOriginal} figura como ${lote.estado} pero no se pudo ` +
          'identificar al comprador. Requiere captura manual.',
      });
      continue;
    }

    ventas.push({
      loteClave: lote.claveOriginal,
      compradorDocumento: doc,
      // Sin precio negociado registrado, se toma el de lista.
      precioNegociado: lote.precioLista,
      fechaVenta: lote.fechaVenta ?? new Date(),
      reconstruida: true,
    });

    incidencias.push({
      nivel: 'aviso',
      entidad: 'Venta',
      detalle:
        `Venta del lote ${lote.claveOriginal} reconstruida a partir del estado del lote: ` +
        'el sistema anterior nunca guardo el registro de venta. Verifique precio y fecha.',
    });
  }

  /* --- Pagos ----------------------------------------------------------- */
  const pagos: PagoNormalizado[] = [];
  if (datos.pagos && typeof datos.pagos === 'object') {
    for (const [, lista] of Object.entries(datos.pagos as Json)) {
      if (!Array.isArray(lista)) continue;
      for (const p of lista as Json[]) {
        const loteCodigo = texto(p.loteCodigo).toUpperCase();
        const lote = lotes.find((l) => l.codigo === loteCodigo);
        if (!lote) {
          incidencias.push({
            nivel: 'error',
            entidad: 'Pago',
            detalle: `Pago sobre un lote inexistente ("${loteCodigo}"). Se omite.`,
            datos: p,
          });
          continue;
        }
        const fecha = leerFecha(p.fecha);
        if (!fecha) {
          incidencias.push({
            nivel: 'error',
            entidad: 'Pago',
            detalle: `Pago sin fecha valida en el lote ${loteCodigo}. Se omite.`,
            datos: p,
          });
          continue;
        }
        const concepto = texto(p.concepto);
        pagos.push({
          loteClave: lote.claveOriginal,
          monto: leerDinero(p.monto, incidencias, `Pago ${loteCodigo}`),
          fecha,
          tipo: /inicial/i.test(concepto)
            ? 'CUOTA_INICIAL'
            : /final/i.test(concepto)
              ? 'PAGO_FINAL'
              : 'ABONO',
          concepto: concepto || null,
        });
      }
    }
  }

  return { proyectos, clientes, lotes, ventas, pagos, incidencias };
}
