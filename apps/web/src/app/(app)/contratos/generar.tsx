'use client';

import { useState } from 'react';
import { useGenerarContrato } from '@/lib/contratos';
import type { OpcionVenta } from '@/lib/formato';
import { Boton, Campo, Seleccion } from '@/components/controles';
import { FormularioDialogo } from '@/components/formulario';
import { IconoMas } from '@/components/iconos';

/** Emite el contrato de una venta vigente que todavía no tiene uno. */
export function BotonGenerarContrato({ ventas }: { ventas: OpcionVenta[] }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState('');
  const { generar, generando, error, limpiarError } = useGenerarContrato();

  function cerrar() {
    setAbierto(false);
    setElegida('');
    limpiarError();
  }

  return (
    <>
      <Boton
        onClick={() => setAbierto(true)}
        iconoIzq={<IconoMas className="size-4" />}
        disabled={ventas.length === 0}
        title={ventas.length === 0 ? 'Todas las ventas vigentes ya tienen contrato' : undefined}
      >
        Generar contrato
      </Boton>

      {abierto && (
        <FormularioDialogo
          abierto
          onCerrar={cerrar}
          titulo="Generar contrato"
          descripcion="Se numera con el siguiente consecutivo y se abre en una pestaña nueva."
          onEnviar={(e) => {
            e.preventDefault();
            if (!elegida) return;
            void generar(elegida).then((ok) => ok && cerrar());
          }}
          enviando={generando}
          errorGeneral={error}
          textoEnviar="Generar contrato"
        >
          <Campo
            etiqueta="Venta"
            ayuda="Solo aparecen las ventas vigentes que aún no tienen contrato"
            requerido
          >
            <Seleccion
              value={elegida}
              onChange={(e) => setElegida(e.target.value)}
              required
              autoFocus
            >
              <option value="" disabled>Seleccione una venta…</option>
              {ventas.map((v) => (
                <option key={v.id} value={v.id}>{v.etiqueta}</option>
              ))}
            </Seleccion>
          </Campo>
        </FormularioDialogo>
      )}
    </>
  );
}
