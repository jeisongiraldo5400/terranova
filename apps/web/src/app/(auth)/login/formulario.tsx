'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { loginSchema } from '@terranova/shared';
import { api, ErrorApi } from '@/lib/api';
import { Boton, Campo, Entrada } from '@/components/controles';
import { IconoClave, IconoCorreo, IconoFlecha } from '@/components/iconos';

export function FormularioLogin() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [verClave, setVerClave] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral(null);
    setErrores({});

    const datos = Object.fromEntries(new FormData(e.currentTarget));

    // Mismo esquema que valida el servidor: el error de formato se detecta
    // sin ida y vuelta, y la regla no está escrita dos veces.
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
      setErrorGeneral(
        error instanceof ErrorApi ? error.message : 'No se pudo conectar con el servidor.',
      );
      if (error instanceof ErrorApi && error.errores) setErrores(error.errores);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {errorGeneral && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[--radius-control] bg-danger-50 px-3.5 py-3 text-sm text-danger-800 ring-1 ring-inset ring-danger-100"
        >
          <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16h.01" />
          </svg>
          {errorGeneral}
        </div>
      )}

      <Campo
        etiqueta="Correo electrónico"
        error={errores.email}
        htmlFor="email"
        requerido
      >
        <Entrada
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="usuario@terranova.co"
          icono={<IconoCorreo className="size-4" />}
          error={Boolean(errores.email)}
          autoFocus
        />
      </Campo>

      <Campo etiqueta="Contraseña" error={errores.password} htmlFor="password" requerido>
        <div className="relative">
          <Entrada
            id="password"
            name="password"
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••"
            icono={<IconoClave className="size-4" />}
            error={Boolean(errores.password)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            className="transicion-suave absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-400 hover:bg-muted-100 hover:text-muted-600"
            aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            tabIndex={-1}
          >
            {verClave ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.4 18.4 0 0 1-2.16 3.19" />
                <path d="M6.6 6.6A18.5 18.5 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.4-1.6" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </Campo>

      <Boton
        type="submit"
        tamano="lg"
        cargando={enviando}
        className="w-full"
      >
        {enviando ? 'Verificando…' : 'Iniciar sesión'}
        {!enviando && <IconoFlecha className="size-4" />}
      </Boton>
    </form>
  );
}
