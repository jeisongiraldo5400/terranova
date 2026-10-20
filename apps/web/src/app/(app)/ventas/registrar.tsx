'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  calcularPlanPago, dineroDesdeTexto, formatearCOP, registrarVentaSchema,
} from '@terranova/shared';
import { api } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { Boton, Campo, Entrada, EntradaDinero, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { Aviso } from '@/components/ui';
import { IconoMas } from '@/components/iconos';
import { area, fechaCorta } from '@/lib/formato';
import type { Cliente, Lote } from '@/lib/tipos';

/* ==========================================================================
   Registro de venta
   --------------------------------------------------------------------------
   El caso de uso que el v0 tenía roto: pages/Ventas.jsx marcaba el lote
   como vendido y generaba el PDF, pero nunca guardaba la venta, de modo
   que los módulos de pagos y contratos quedaban vacíos para siempre.

   La vista previa del plan se calcula en el navegador con el MISMO
   calcularPlanPago() que ejecutará el servidor, así que lo que se ve antes
   de confirmar es exactamente lo que quedará guardado.
   ========================================================================== */

export function BotonRegistrarVenta({
  lotes, clientes,
}: { lotes: Lote[]; clientes: Cliente[] }) {
  const [abierto, setAbierto] = useState(false);

  const sinInventario = lotes.length === 0;
  const sinClientes = clientes.length === 0;

  return (
    <>
      <Boton
        onClick={() => setAbierto(true)}
        iconoIzq={<IconoMas className="size-4" />}
        disabled={sinInventario || sinClientes}
        title={
          sinInventario ? 'No hay lotes disponibles'
          : sinClientes ? 'No hay clientes registrados' : undefined
        }
      >
        Registrar venta
      </Boton>
      {abierto && (
        <FormularioVenta lotes={lotes} clientes={clientes} onCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}

const hoy = () => new Date().toISOString().slice(0, 10);

function FormularioVenta({
  lotes, clientes, onCerrar,
}: { lotes: Lote[]; clientes: Cliente[]; onCerrar: () => void }) {
  const router = useRouter();

  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [clienteId, setClienteId] = useState('');
  // Los montos llegan de la API como "97500000.00"; mostrar los centavos
  // en cero solo estorba al escribir.
  const sinCentavos = (v: string | undefined) => (v ?? '').replace(/\.00$/, '');

  const [precio, setPrecio] = useState(sinCentavos(lotes[0]?.precioLista));
  const [pctInicial, setPctInicial] = useState('30');
  const [fechaVenta, setFechaVenta] = useState(hoy());
  const [modalidad, setModalidad] = useState<'DOS_PAGOS' | 'CUOTAS'>('DOS_PAGOS');
  const [numeroCuotas, setNumeroCuotas] = useState('12');
  const [fechaFinal, setFechaFinal] = useState(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: registrarVentaSchema,
    enviar: async (datos) => {
      const venta = await api.post<{ id: string }>('/ventas', datos);
      router.push(`/ventas/${venta.id}`);
      return venta;
    },
    alTerminar: onCerrar,
  });

  const lote = lotes.find((l) => l.id === loteId);

  /**
   * Vista previa del plan. Se recalcula en cada tecla con el módulo de
   * dominio compartido; si los datos no forman un plan válido, se muestra
   * el motivo en lugar de dejar que el error aparezca al enviar.
   */
  const vistaPrevia = useMemo(() => {
    if (!precio || !fechaVenta) return null;
    try {
      return {
        plan: calcularPlanPago({
          // dineroDesdeTexto, no un replace a mano: el valor del campo
          // puede venir del lote en forma canónica ("97500000.00") o
          // escrito por la persona ("97.500.000"). Quitar los puntos sin
          // distinguir convertía 97.500.000,00 en 9.750 millones.
          precioNegociado: dineroDesdeTexto(precio),
          porcentajeInicial: Number(pctInicial),
          fechaVenta: new Date(`${fechaVenta}T00:00:00Z`),
          modalidad:
            modalidad === 'DOS_PAGOS'
              ? { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date(`${fechaFinal}T00:00:00Z`) }
              : { tipo: 'CUOTAS', numeroCuotas: Number(numeroCuotas) },
        }),
        error: null,
      };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : 'Plan inválido' };
    }
  }, [precio, pctInicial, fechaVenta, modalidad, numeroCuotas, fechaFinal]);

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Registrar venta"
      descripcion="El lote queda bloqueado en la misma transacción, de modo que no puede venderse dos veces."
      onEnviar={(e) => {
        e.preventDefault();
        const datos = datosDelFormulario(e.currentTarget);
        // La modalidad es un objeto anidado; el <form> plano no puede
        // expresarla, así que se arma aquí.
        datos.modalidad =
          modalidad === 'DOS_PAGOS'
            ? { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: fechaFinal }
            : { tipo: 'CUOTAS', numeroCuotas: Number(numeroCuotas) };
        delete datos.numeroCuotas;
        delete datos.fechaLimitePagoFinal;
        void procesar(datos);
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Registrar venta"
    >
      <Rejilla>
        <Campo etiqueta="Lote" error={errores.loteId} requerido>
          <Seleccion
            name="loteId"
            value={loteId}
            onChange={(e) => {
              setLoteId(e.target.value);
              const l = lotes.find((x) => x.id === e.target.value);
              if (l) setPrecio(sinCentavos(l.precioLista));
            }}
            required
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.proyecto.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Cliente" error={errores.clienteId} requerido>
          <Seleccion
            name="clienteId"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            required
          >
            <option value="">Seleccione un cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {c.documento}
              </option>
            ))}
          </Seleccion>
        </Campo>
      </Rejilla>

      {lote && (
        <p className="rounded-[--radius-control] bg-muted-50 px-3.5 py-2.5 text-xs text-muted-600">
          <span className="font-mono font-medium text-ink-900">{lote.codigo}</span> ·{' '}
          {area(lote.areaM2)} · precio de lista{' '}
          <span className="tabular font-medium">{formatearCOP(lote.precioLista)}</span>
        </p>
      )}

      <Rejilla>
        <Campo
          etiqueta="Precio negociado"
          error={errores.precioNegociado}
          ayuda="Se negocia con cada cliente; puede diferir del de lista"
          requerido
        >
          <EntradaDinero
            name="precioNegociado"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            error={Boolean(errores.precioNegociado)}
          />
        </Campo>

        <Campo etiqueta="Fecha de venta" error={errores.fechaVenta} requerido>
          <Entrada
            name="fechaVenta"
            type="date"
            max={hoy()}
            value={fechaVenta}
            onChange={(e) => setFechaVenta(e.target.value)}
            error={Boolean(errores.fechaVenta)}
          />
        </Campo>

        <Campo
          etiqueta="Cuota inicial (%)"
          error={errores.porcentajeInicial}
          ayuda="Mínimo 10% del precio"
          requerido
        >
          <Entrada
            name="porcentajeInicial"
            inputMode="decimal"
            value={pctInicial}
            onChange={(e) => setPctInicial(e.target.value)}
            className="tabular text-right"
            error={Boolean(errores.porcentajeInicial)}
          />
        </Campo>

        <Campo etiqueta="Modalidad de pago" requerido>
          <Seleccion
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as 'DOS_PAGOS' | 'CUOTAS')}
          >
            <option value="DOS_PAGOS">Dos pagos: inicial y final</option>
            <option value="CUOTAS">Cuotas mensuales</option>
          </Seleccion>
        </Campo>
      </Rejilla>

      {modalidad === 'DOS_PAGOS' ? (
        <Campo
          etiqueta="Fecha límite del pago final"
          error={errores['modalidad.fechaLimitePagoFinal']}
          requerido
        >
          <Entrada
            type="date"
            value={fechaFinal}
            min={fechaVenta}
            onChange={(e) => setFechaFinal(e.target.value)}
          />
        </Campo>
      ) : (
        <Campo
          etiqueta="Número de cuotas mensuales"
          error={errores['modalidad.numeroCuotas']}
          ayuda="Además de la cuota inicial"
          requerido
        >
          <Entrada
            inputMode="numeric"
            value={numeroCuotas}
            onChange={(e) => setNumeroCuotas(e.target.value)}
            className="tabular text-right"
          />
        </Campo>
      )}

      {/* --- Vista previa del plan --- */}
      {vistaPrevia?.error && <Aviso tono="alerta">{vistaPrevia.error}</Aviso>}

      {vistaPrevia?.plan && (
        <div className="overflow-hidden rounded-[--radius-control] ring-1 ring-muted-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-50 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-brand-900">
              Plan de pago · {vistaPrevia.plan.cuotas.length} cuota(s)
            </p>
            <p className="tabular text-xs text-brand-800">
              Inicial {formatearCOP(vistaPrevia.plan.cuotaInicial)} · Saldo{' '}
              {formatearCOP(vistaPrevia.plan.saldoFinanciado)}
            </p>
          </div>

          <div className="scroll-fino max-h-44 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {vistaPrevia.plan.cuotas.map((c) => (
                  <tr key={c.numero} className="border-b border-muted-200/60 last:border-b-0">
                    <td className="px-3.5 py-1.5 text-muted-500">{c.numero}</td>
                    <td className="px-2 py-1.5 font-medium text-ink-900">{c.descripcion}</td>
                    <td className="tabular px-2 py-1.5 text-right">
                      {formatearCOP(c.montoEsperado)}
                    </td>
                    <td className="tabular px-3.5 py-1.5 text-right text-muted-500">
                      {fechaCorta(c.fechaVencimiento.toISOString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-muted-200 bg-muted-50 px-3.5 py-2 text-2xs text-muted-500">
            Las cuotas suman exactamente el precio negociado. Calculado con el mismo módulo que
            usará el servidor.
          </p>
        </div>
      )}
    </FormularioDialogo>
  );
}
