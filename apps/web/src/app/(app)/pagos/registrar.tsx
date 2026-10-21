'use client';

import { useState } from 'react';
import type { OpcionVenta } from '@/lib/formato';
import { Boton } from '@/components/controles';
import { FormularioPago } from '@/components/formulario-pago';
import { IconoMas } from '@/components/iconos';

/** El mismo formulario del detalle de la venta, eligiendo antes la venta. */
export function BotonRegistrarPago({ ventas }: { ventas: OpcionVenta[] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Boton
        onClick={() => setAbierto(true)}
        iconoIzq={<IconoMas className="size-4" />}
        disabled={ventas.length === 0}
        title={ventas.length === 0 ? 'No hay ventas con saldo pendiente' : undefined}
      >
        Registrar pago
      </Boton>
      {abierto && <FormularioPago ventas={ventas} onCerrar={() => setAbierto(false)} />}
    </>
  );
}
