'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Seleccion } from '@/components/controles';
import { conQuery } from '@/lib/rutas';

const ENTIDADES = ['Venta', 'Pago', 'Lote', 'Cliente', 'Proyecto', 'Contrato', 'Usuario'];

export function FiltrosAuditoria({ valores }: { valores: Record<string, string | undefined> }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Seleccion
      defaultValue={valores.entidad ?? ''}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        if (e.target.value) p.set('entidad', e.target.value);
        else p.delete('entidad');
        router.replace(conQuery('/auditoria', Object.fromEntries(p)));
      }}
      aria-label="Filtrar por entidad"
      className="max-w-xs"
    >
      <option value="">Todas las entidades</option>
      {ENTIDADES.map((e) => (
        <option key={e} value={e}>{e}</option>
      ))}
    </Seleccion>
  );
}
