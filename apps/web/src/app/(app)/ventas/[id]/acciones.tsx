'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MetodoPago, TipoPago, ETIQUETA_METODO_PAGO, ETIQUETA_TIPO_PAGO, formatearCOP } from '@terranova/shared';
import { api, ErrorApi } from '@/lib/api';
import { AreaTexto, Boton, Campo, Entrada, EntradaDinero, Seleccion } from '@/components/controles';
import { Dialogo } from '@/components/dialogo';
import { Aviso } from '@/components/ui';

export function AccionesVenta({
  ventaId, saldo, puedePagar, puedeContrato, contratos,
}: {
  ventaId: string;
  saldo: string;
  puedePagar: boolean;
  puedeAnular: boolean;
  puedeContrato: boolean;
  contratos: Array<{ id: string; numero: string; version: number }>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [generando, setGenerando] = useState(false);

  const contratoVigente = contratos[0];
  const sinSaldo = Number(saldo) <= 0;

  async function registrarPago(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral(null);
    setErrores({});
    setEnviando(true);

    const f = new FormData(e.currentTarget);
    try {
      await api.post('/pagos', {
        ventaId,
        tipo: f.get('tipo'),
        // El monto viaja como texto: el servidor lo interpreta con la
        // convencion colombiana. No se convierte a number en el navegador.
        monto: f.get('monto'),
        fecha: f.get('fecha'),
        metodo: f.get('metodo'),
        referencia: f.get('referencia') || null,
        concepto: f.get('concepto') || null,
      });
      setAbierto(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        setErrorGeneral(error.message);
        if (error.errores) setErrores(error.errores);
      } else {
        setErrorGeneral('No se pudo registrar el pago.');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function generarContrato() {
    setGenerando(true);
    try {
      const c = await api.post<{ id: string }>('/contratos', { ventaId, regenerar: false });
      window.open(`/api/contratos/${c.id}/pdf`, '_blank');
      router.refresh();
    } catch (error) {
      setErrorGeneral(error instanceof ErrorApi ? error.message : 'No se pudo generar el contrato.');
    } finally {
      setGenerando(false);
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap gap-2">
      {puedeContrato &&
        (contratoVigente ? (
          <a
            href={`/api/contratos/${contratoVigente.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-[--radius-control] bg-white px-3.5 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-muted-300 hover:bg-muted-100"
          >
            Contrato {contratoVigente.numero} v{contratoVigente.version}
          </a>
        ) : (
          <Boton variante="secundario" onClick={generarContrato} cargando={generando}>
            Generar contrato
          </Boton>
        ))}

      {puedePagar && (
        <Boton onClick={() => setAbierto(true)} disabled={sinSaldo}>
          {sinSaldo ? 'Sin saldo pendiente' : 'Registrar abono'}
        </Boton>
      )}

      <Dialogo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Registrar abono"
        descripcion={`Saldo pendiente: ${formatearCOP(saldo)}`}
      >
        <form onSubmit={registrarPago} className="space-y-4" id="form-pago">
          {errorGeneral && <Aviso tono="peligro">{errorGeneral}</Aviso>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Monto" error={errores.monto} requerido>
              <EntradaDinero name="monto" required error={Boolean(errores.monto)} autoFocus />
            </Campo>

            <Campo etiqueta="Fecha" error={errores.fecha} requerido>
              <Entrada
                name="fecha"
                type="date"
                defaultValue={hoy}
                max={hoy}
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
          </div>

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

          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" type="button" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enviando}>
              Registrar abono
            </Boton>
          </div>
        </form>
      </Dialogo>
    </div>
  );
}
