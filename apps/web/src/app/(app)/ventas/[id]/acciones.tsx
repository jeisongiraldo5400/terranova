'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO, MetodoPago, TipoPago,
  anularPagoSchema, anularVentaSchema, formatearCOP, registrarPagoSchema,
} from '@terranova/shared';
import { api, ErrorApi } from '@/lib/api';
import { datosDelFormulario, useFormulario } from '@/lib/formulario';
import { AreaTexto, Boton, Campo, Entrada, EntradaDinero, Seleccion } from '@/components/controles';
import { FormularioDialogo, Rejilla } from '@/components/formulario';
import { Aviso } from '@/components/ui';
import { IconoContratos, IconoMas } from '@/components/iconos';

const hoy = () => new Date().toISOString().slice(0, 10);

/* ==========================================================================
   Acciones sobre una venta
   ========================================================================== */

export function AccionesVenta({
  ventaId, saldo, puedePagar, puedeContrato, puedeAnular, estadoVenta,
  pagosVigentes, contratos,
}: {
  ventaId: string;
  saldo: string;
  puedePagar: boolean;
  puedeContrato: boolean;
  puedeAnular: boolean;
  estadoVenta: string;
  pagosVigentes: number;
  contratos: Array<{ id: string; numero: string; version: number }>;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<'pago' | 'anular' | null>(null);
  const [generando, setGenerando] = useState(false);
  const [errorContrato, setErrorContrato] = useState<string | null>(null);

  const contratoVigente = contratos[0];
  const sinSaldo = Number(saldo) <= 0;
  const anulada = estadoVenta === 'ANULADA';

  async function generarContrato() {
    setGenerando(true);
    setErrorContrato(null);
    try {
      const c = await api.post<{ id: string }>('/contratos', { ventaId, regenerar: false });
      window.open(`/api/contratos/${c.id}/pdf`, '_blank');
      router.refresh();
    } catch (e) {
      setErrorContrato(
        e instanceof ErrorApi ? e.message : 'No se pudo generar el contrato.',
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {errorContrato && (
        <span className="w-full text-xs text-danger-600">{errorContrato}</span>
      )}

      {puedeContrato &&
        (contratoVigente ? (
          <a
            href={`/api/contratos/${contratoVigente.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="transicion-suave inline-flex h-8 items-center gap-1.5 rounded-[--radius-control] bg-white px-3 text-xs font-medium text-ink-700 shadow-[--shadow-card] ring-1 ring-inset ring-muted-200 hover:bg-muted-50"
          >
            <IconoContratos className="size-3.5" />
            {contratoVigente.numero} v{contratoVigente.version}
          </a>
        ) : (
          <Boton variante="secundario" tamano="sm" onClick={generarContrato} cargando={generando}>
            Generar contrato
          </Boton>
        ))}

      {puedeAnular && !anulada && (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => setDialogo('anular')}
          className="text-danger-600 hover:bg-danger-50"
        >
          Anular venta
        </Boton>
      )}

      {puedePagar && (
        <Boton
          tamano="sm"
          onClick={() => setDialogo('pago')}
          disabled={sinSaldo}
          iconoIzq={<IconoMas className="size-3.5" />}
        >
          {sinSaldo ? 'Sin saldo' : 'Registrar abono'}
        </Boton>
      )}

      {dialogo === 'pago' && (
        <FormularioPago ventaId={ventaId} saldo={saldo} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === 'anular' && (
        <FormularioAnularVenta
          ventaId={ventaId}
          pagosVigentes={pagosVigentes}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}

/* --- Registrar abono ------------------------------------------------------ */

function FormularioPago({
  ventaId, saldo, onCerrar,
}: { ventaId: string; saldo: string; onCerrar: () => void }) {
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
      descripcion={`Saldo pendiente: ${formatearCOP(saldo)}`}
      onEnviar={(e) => {
        e.preventDefault();
        void procesar({ ...datosDelFormulario(e.currentTarget), ventaId });
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
      textoEnviar="Registrar abono"
    >
      <Rejilla>
        <Campo etiqueta="Monto" error={errores.monto} requerido>
          <EntradaDinero name="monto" required error={Boolean(errores.monto)} autoFocus />
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

/* --- Anular venta --------------------------------------------------------- */

/**
 * La anulación no borra nada: marca la venta, reversa los pagos y libera
 * el lote. El motivo es obligatorio y queda en la auditoría, porque la
 * pregunta "¿quién anuló esto y por qué?" no tenía respuesta en el v0.
 */
function FormularioAnularVenta({
  ventaId, pagosVigentes, onCerrar,
}: { ventaId: string; pagosVigentes: number; onCerrar: () => void }) {
  const router = useRouter();

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: anularVentaSchema,
    enviar: (datos) => api.post(`/ventas/${ventaId}/anular`, datos),
    alTerminar: () => {
      onCerrar();
      router.refresh();
    },
  });

  return (
    <FormularioDialogo
      abierto
      onCerrar={onCerrar}
      titulo="Anular venta"
      variante="peligro"
      textoEnviar="Anular venta"
      onEnviar={(e) => {
        e.preventDefault();
        const datos = datosDelFormulario(e.currentTarget);
        datos.anularPagos = true;
        void procesar(datos);
      }}
      enviando={enviando}
      errorGeneral={errorGeneral}
    >
      <Aviso tono="peligro" titulo="Esto es lo que va a ocurrir">
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>La venta queda marcada como anulada; no se borra.</li>
          {pagosVigentes > 0 && (
            <li>
              Sus <strong>{pagosVigentes} pago(s) vigente(s)</strong> se anulan con el mismo
              motivo. Tampoco se borran.
            </li>
          )}
          <li>El lote vuelve a estado DISPONIBLE y podrá venderse de nuevo.</li>
          <li>Queda registro en la auditoría con su usuario y la fecha.</li>
        </ul>
      </Aviso>

      <Campo
        etiqueta="Motivo de la anulación"
        error={errores.motivo}
        ayuda="Mínimo 10 caracteres. Quedará en el registro permanente."
        requerido
      >
        <AreaTexto
          name="motivo"
          rows={3}
          placeholder="El comprador se retractó dentro del plazo legal."
          error={Boolean(errores.motivo)}
          autoFocus
        />
      </Campo>
    </FormularioDialogo>
  );
}

/* --- Anular pago ---------------------------------------------------------- */

export function BotonAnularPago({
  pagoId, monto,
}: { pagoId: string; monto: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const { enviando, errorGeneral, errores, procesar } = useFormulario({
    schema: anularPagoSchema,
    enviar: (datos) => api.post(`/pagos/${pagoId}/anular`, datos),
    alTerminar: () => {
      setAbierto(false);
      router.refresh();
    },
  });

  return (
    <>
      <Boton
        variante="fantasma"
        tamano="sm"
        onClick={() => setAbierto(true)}
        className="text-danger-600 hover:bg-danger-50"
      >
        Anular
      </Boton>

      {abierto && (
        <FormularioDialogo
          abierto
          onCerrar={() => setAbierto(false)}
          titulo="Anular pago"
          descripcion={`Pago de ${formatearCOP(monto)}`}
          variante="peligro"
          textoEnviar="Anular pago"
          onEnviar={(e) => {
            e.preventDefault();
            void procesar(datosDelFormulario(e.currentTarget));
          }}
          enviando={enviando}
          errorGeneral={errorGeneral}
        >
          <Aviso tono="alerta">
            El pago no se borra: queda marcado como anulado, con su motivo y su autor. El saldo
            de la venta se recalcula, y si estaba liquidada volverá a quedar activa.
          </Aviso>

          <Campo
            etiqueta="Motivo de la anulación"
            error={errores.motivo}
            ayuda="Mínimo 10 caracteres"
            requerido
          >
            <AreaTexto
              name="motivo"
              rows={3}
              placeholder="Cheque devuelto por el banco, fondos insuficientes."
              error={Boolean(errores.motivo)}
              autoFocus
            />
          </Campo>
        </FormularioDialogo>
      )}
    </>
  );
}
