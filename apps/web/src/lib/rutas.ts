import type { Route } from 'next';

/**
 * Construye una ruta con query para router.push/replace.
 *
 * Con typedRoutes activo, el router solo acepta rutas conocidas en tiempo
 * de compilacion, y una plantilla con query es opaca para el verificador.
 * El pathname sigue siendo tipado -- que es lo que importa: un enlace a
 * una pagina inexistente falla al compilar; la query no tiene por que.
 */
export function conQuery(pathname: Route, query: Record<string, string | undefined>): Route {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  return (qs ? `${pathname}?${qs}` : pathname) as Route;
}
