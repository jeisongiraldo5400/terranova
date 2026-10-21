'use client';

import { useState } from 'react';
import {
  ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO, MetodoPago, TipoPago,
  formatearCOP, registrarPagoSchema,
} from '@terranova/shared';
import { api } from '@/lib/api';
import type { OpcionVenta } from '@/lib/formato';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { AreaTexto, Campo, Entrada, EntradaDinero, Seleccion } from './controles';
import { FormularioDialogo, Rejilla } from './formulario';

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Registrar un abono.
 *
 * Desde el detalle de una venta llega con `ventaId` fijo. Desde la pantalla
 * de pagos llega con `ventas`, y el usuario elige primero a cuál aplica.
 */
export function FormularioPago({
  ventaId, saldo, ventas, onCerrar,
}: {
  ventaId?: string;
  saldo?: string;
  ventas?: OpcionVenta[];
  onCerrar: () => void;
}) {
  const [elegida, setElegida] = useState(ventaId ?? '');
  const saldoActual = ventas ? ventas.find((v) => v.id === elegida)?.saldo : saldo;

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: registrarPagoSchema,
    enviar: (datos) => api.post('/pagos', datos),
    alTerminar: onCerrar,
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo="Registrar abono"
      descripcion={
        saldoActual
          ? `Saldo pendiente: ${formatearCOP(saldoActual)}`
          : 'Elija la venta a la que se aplica el pago.'
      }
      onEnviar={(e) => {
        e.preventDefault();
        void procesar({ ...datosDelFormulario(e.currentTarget), ventaId: elegida });
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Registrar abono"
    >
      {ventas && (
        <Campo
          etiqueta="Venta"
          error={errores.ventaId}
          ayuda="Solo aparecen las ventas vigentes con saldo pendiente"
          requerido
        >
          <Seleccion
            value={elegida}
            onChange={(e) => setElegida(e.target.value)}
            required
            error={Boolean(errores.ventaId)}
            autoFocus
          >
            <option value="" disabled>Seleccione una venta…</option>
            {ventas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.etiqueta} — saldo {formatearCOP(v.saldo)}
              </option>
            ))}
          </Seleccion>
        </Campo>
      )}

      <Rejilla>
        <Campo etiqueta="Monto" error={errores.monto} requerido>
          <EntradaDinero
            name="monto"
            required
            error={Boolean(errores.monto)}
            autoFocus={!ventas}
          />
        </Campo>

        <Campo etiqueta="Fecha" error={errores.fecha} requerido>
          <Entrada
            name="fecha"
            type="date"
            defaultValue={hoy()}
            max={hoy()}
            required
            error={Boolean(errores.fecha)}
          />
        </Campo>

        <Campo etiqueta="Tipo" error={errores.tipo} requerido>
          <Seleccion name="tipo" defaultValue={TipoPago.ABONO} required>
            {Object.values(TipoPago).map((t) => (
              <option key={t} value={t}>{ETIQUETA_TIPO_PAGO[t]}</option>
            ))}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Método" error={errores.metodo} requerido>
          <Seleccion name="metodo" defaultValue={MetodoPago.TRANSFERENCIA} required>
            {Object.values(MetodoPago).map((m) => (
              <option key={m} value={m}>{ETIQUETA_METODO_PAGO[m]}</option>
            ))}
          </Seleccion>
        </Campo>
      </Rejilla>

      <Campo
        etiqueta="Referencia"
        error={errores.referencia}
        ayuda="Número de transferencia, cheque o consignación"
      >
        <Entrada name="referencia" placeholder="TRF-123456" />
      </Campo>

      <Campo etiqueta="Concepto" error={errores.concepto}>
        <AreaTexto name="concepto" rows={2} placeholder="Observaciones del pago" />
      </Campo>
    </FormularioDialogo>
  );
}
