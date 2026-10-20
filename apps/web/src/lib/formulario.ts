'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { ZodSchema } from 'zod';
import { ErrorApi } from './api';

export interface EstadoFormulario {
  enviando: boolean;
  errorGeneral: string | null;
  errores: Record<string, string>;
}

/**
 * Plomeria compartida por todos los formularios.
 *
 * Valida con el MISMO esquema Zod que usa la API, de modo que el error de
 * formato se ve sin ida y vuelta y el mensaje es idéntico en los dos lados.
 * Si el servidor rechaza igualmente (una regla que solo él puede evaluar,
 * como "el lote ya está vendido"), reparte sus errores por campo.
 *
 * En el v0 cada pantalla repetía esta lógica con alert(), y las
 * validaciones de pages/ y components/ ya habían divergido.
 */
export function useFormulario<T>({
  schema,
  enviar,
  alTerminar,
}: {
  schema: ZodSchema<T>;
  enviar: (datos: T) => Promise<unknown>;
  alTerminar?: () => void;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoFormulario>({
    enviando: false,
    errorGeneral: null,
    errores: {},
  });

  const limpiar = useCallback(() => {
    setEstado({ enviando: false, errorGeneral: null, errores: {} });
  }, []);

  const procesar = useCallback(
    async (crudo: Record<string, unknown>) => {
      setEstado({ enviando: false, errorGeneral: null, errores: {} });

      const resultado = schema.safeParse(crudo);
      if (!resultado.success) {
        const porCampo: Record<string, string> = {};
        for (const i of resultado.error.issues) porCampo[i.path.join('.')] ??= i.message;
        setEstado({ enviando: false, errorGeneral: null, errores: porCampo });
        return false;
      }

      setEstado((e) => ({ ...e, enviando: true }));
      try {
        await enviar(resultado.data);
        // refresh() revalida los componentes de servidor: la tabla de
        // atrás se actualiza sin recargar la página entera.
        router.refresh();
        alTerminar?.();
        setEstado({ enviando: false, errorGeneral: null, errores: {} });
        return true;
      } catch (error) {
        setEstado({
          enviando: false,
          errorGeneral:
            error instanceof ErrorApi
              ? error.message
              : 'No se pudo completar la operación. Intente de nuevo.',
          errores: error instanceof ErrorApi ? (error.errores ?? {}) : {},
        });
        return false;
      }
    },
    [schema, enviar, alTerminar, router],
  );

  return { ...estado, procesar, limpiar };
}

/** Lee un <form> como objeto, descartando los campos vacíos opcionales. */
export function datosDelFormulario(form: HTMLFormElement): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of new FormData(form).entries()) {
    if (typeof valor === 'string') {
      // Un campo opcional vacío debe llegar como ausente, no como "",
      // o los esquemas con .optional() lo rechazarían por formato.
      if (valor === '') continue;
      salida[clave] = valor;
    }
  }
  return salida;
}
