-- ===========================================================================
-- Correccion del envoltorio inmutable de unaccent()
-- ---------------------------------------------------------------------------
-- La version anterior fallaba al crear el indice GIN con:
--   ERROR: text search dictionary "unaccent" does not exist
--   WHERE: SQL function "inmutable_unaccent" during inlining
--
-- Causa: al construir la expresion del indice, Postgres INLINE la funcion
-- SQL y vuelve a resolver el cast ::regdictionary, esta vez con el
-- search_path de la sesion que ejecuta la migracion.
--
-- Solucion: calificar el esquema y fijar search_path en la propia funcion.
-- `SET search_path` tiene el efecto adicional de impedir el inlining, de
-- modo que la resolucion ocurre una sola vez, al crear la funcion.
-- ===========================================================================

CREATE OR REPLACE FUNCTION inmutable_unaccent(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = public, pg_catalog
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, texto)
$$;
