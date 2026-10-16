'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Entrada } from '@/components/controles';
import { IconoBuscar } from '@/components/iconos';
import { conQuery } from '@/lib/rutas';

export function BuscadorClientes({ valor }: { valor: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(valor);

  // Espera a que la persona deje de escribir: una petición por tecla
  // saturaría el servidor sin mejorar la experiencia.
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
      icono={<IconoBuscar className="size-4" />}
      className="max-w-md"
    />
  );
}
