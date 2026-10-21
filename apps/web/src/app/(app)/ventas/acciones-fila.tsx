'use client';

import { useState } from 'react';
import { useGenerarContrato } from '@/lib/contratos';
import { Boton } from '@/components/controles';
import { FormularioPago } from '@/components/formulario-pago';

/**
 * Atajos en cada fila del listado, para no tener que entrar al detalle.
 * "Contrato" abre el vigente o lo emite si aún no existe: la API devuelve
 * el vigente cuando no se pide regenerar.
 */
export function AccionesFilaVenta({
  ventaId, saldo, puedePagar, puedeContrato,
}: {
  ventaId: string;
  saldo: string;
  puedePagar: boolean;
  puedeContrato: boolean;
}) {
  const [pagando, setPagando] = useState(false);
  const { generar, generando, error } = useGenerarContrato();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {puedeContrato && (
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={() => void generar(ventaId)}
          cargando={generando}
          title="Abre el contrato, o lo genera si aún no existe"
        >
          Contrato
        </Boton>
      )}
      {puedePagar && Number(saldo) > 0 && (
        <Boton variante="secundario" tamano="sm" onClick={() => setPagando(true)}>
          Abonar
        </Boton>
      )}
      {error && <span className="w-full text-right text-2xs text-danger-600">{error}</span>}
      {pagando && (
        <FormularioPago ventaId={ventaId} saldo={saldo} onCerrar={() => setPagando(false)} />
      )}
    </div>
  );
}
