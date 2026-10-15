'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { loginSchema } from '@terranova/shared';
import { api, ErrorApi } from '@/lib/api';
import { Boton, Campo, Entrada } from '@/components/controles';
import { Aviso } from '@/components/ui';

export function FormularioLogin() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral(null);
    setErrores({});

    const datos = Object.fromEntries(new FormData(e.currentTarget));

    // Mismo esquema que valida el servidor: el error de formato se detecta
    // sin ida y vuelta, y la regla no esta escrita dos veces.
    const resultado = loginSchema.safeParse(datos);
    if (!resultado.success) {
      const porCampo: Record<string, string> = {};
      for (const i of resultado.error.issues) porCampo[i.path.join('.')] ??= i.message;
      setErrores(porCampo);
      return;
    }

    setEnviando(true);
    try {
      await api.post('/auth/login', resultado.data);
      router.replace('/');
      router.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        setErrorGeneral(error.message);
        if (error.errores) setErrores(error.errores);
      } else {
        setErrorGeneral('No se pudo conectar con el servidor.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      {errorGeneral && <Aviso tono="peligro">{errorGeneral}</Aviso>}

      <Campo etiqueta="Correo electrónico" error={errores.email} requerido>
        <Entrada
          name="email"
          type="email"
          autoComplete="username"
          placeholder="usuario@terranova.co"
          error={Boolean(errores.email)}
          autoFocus
        />
      </Campo>

      <Campo etiqueta="Contraseña" error={errores.password} requerido>
        <Entrada
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={Boolean(errores.password)}
        />
      </Campo>

      <Boton type="submit" cargando={enviando} className="w-full">
        Iniciar sesión
      </Boton>
    </form>
  );
}
