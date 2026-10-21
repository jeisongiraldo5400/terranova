'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ErrorApi } from './api';

/**
 * Genera el contrato de una venta (o devuelve el vigente) y abre su PDF.
 *
 * La pestaña se abre ANTES de la petición: abierta después del await, el
 * navegador ya no la asocia al clic del usuario y la bloquea como ventana
 * emergente, de modo que el contrato se generaba pero nunca se veía.
 */
export function useGenerarContrato() {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar(ventaId: string, regenerar = false): Promise<boolean> {
    setGenerando(true);
    setError(null);
    const pestana = window.open('', '_blank');
    try {
      const c = await api.post<{ id: string }>('/contratos', { ventaId, regenerar });
      const url = `/api/contratos/${c.id}/pdf`;
      if (pestana) pestana.location.href = url;
      else window.location.href = url;
      router.refresh();
      return true;
    } catch (e) {
      pestana?.close();
      setError(e instanceof ErrorApi ? e.message : 'No se pudo generar el contrato.');
      return false;
    } finally {
      setGenerando(false);
    }
  }

  return { generar, generando, error, limpiarError: () => setError(null) };
}
