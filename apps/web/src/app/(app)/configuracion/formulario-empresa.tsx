'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { configuracionEmpresaSchema } from '@terranova/shared';
import { api, ErrorApi } from '@/lib/api';
import { AreaTexto, Boton, Campo, Entrada } from '@/components/controles';
import { Aviso } from '@/components/ui';

interface Empresa {
  razonSocial: string; nit: string; direccion: string; ciudad: string;
  telefono: string; email: string; representanteLegal: string;
  documentoRepresentante: string; clausulasContrato: string | null;
}

export function FormularioEmpresa({
  inicial, soloLectura,
}: { inicial: Empresa | null; soloLectura: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral(null);
    setErrores({});
    setExito(false);

    const datos = Object.fromEntries(new FormData(e.currentTarget));

    // El mismo esquema que valida la API: los errores de formato se ven
    // antes de enviar y los mensajes son idénticos en los dos lados.
    const resultado = configuracionEmpresaSchema.safeParse(datos);
    if (!resultado.success) {
      const porCampo: Record<string, string> = {};
      for (const i of resultado.error.issues) porCampo[i.path.join('.')] ??= i.message;
      setErrores(porCampo);
      return;
    }

    setEnviando(true);
    try {
      await api.put('/configuracion/empresa', resultado.data);
      setExito(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        setErrorGeneral(error.message);
        if (error.errores) setErrores(error.errores);
      } else {
        setErrorGeneral('No se pudo guardar la configuración.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const campos = [
    { name: 'razonSocial', etiqueta: 'Razón social', ancho: 'sm:col-span-2' },
    { name: 'nit', etiqueta: 'NIT' },
    { name: 'telefono', etiqueta: 'Teléfono' },
    { name: 'direccion', etiqueta: 'Dirección', ancho: 'sm:col-span-2' },
    { name: 'ciudad', etiqueta: 'Ciudad' },
    { name: 'email', etiqueta: 'Correo electrónico', type: 'email' },
    { name: 'representanteLegal', etiqueta: 'Representante legal' },
    { name: 'documentoRepresentante', etiqueta: 'Documento del representante' },
  ] as const;

  return (
    <form onSubmit={enviar} className="space-y-4">
      {errorGeneral && <Aviso tono="peligro">{errorGeneral}</Aviso>}
      {exito && <Aviso tono="exito">Configuración guardada.</Aviso>}

      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((c) => (
          <div key={c.name} className={'ancho' in c ? c.ancho : undefined}>
            <Campo etiqueta={c.etiqueta} error={errores[c.name]} requerido>
              <Entrada
                name={c.name}
                type={'type' in c ? c.type : 'text'}
                defaultValue={inicial?.[c.name] ?? ''}
                disabled={soloLectura}
                error={Boolean(errores[c.name])}
              />
            </Campo>
          </div>
        ))}
      </div>

      <Campo
        etiqueta="Cláusulas del contrato"
        error={errores.clausulasContrato}
        ayuda="Texto que se inserta al final de cada contrato generado"
      >
        <AreaTexto
          name="clausulasContrato"
          rows={10}
          defaultValue={inicial?.clausulasContrato ?? ''}
          disabled={soloLectura}
          className="font-mono text-xs"
        />
      </Campo>

      {!soloLectura && (
        <div className="flex justify-end">
          <Boton type="submit" cargando={enviando}>
            Guardar configuración
          </Boton>
        </div>
      )}
    </form>
  );
}
