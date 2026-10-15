'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Entrada } from '@/components/controles';
import { conQuery } from '@/lib/rutas';

export function BuscadorClientes({ valor }: { valor: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(valor);

  // Espera a que la persona deje de escribir antes de consultar, para no
  // lanzar una peticion por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(conQuery('/clientes', { buscar: texto }));
    }, 300);
    return () => clearTimeout(t);
  }, [texto, router]);

  return (
    <Entrada
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      placeholder="Buscar por nombre, cédula, teléfono o ciudad…"
      aria-label="Buscar cliente"
      className="max-w-md"
    />
  );
}
