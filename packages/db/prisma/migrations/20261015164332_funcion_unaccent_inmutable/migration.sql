-- ===========================================================================
-- Envoltorio inmutable de unaccent()
-- ---------------------------------------------------------------------------
-- unaccent() es STABLE y Postgres no admite funciones no inmutables en una
-- expresion de indice. Fijar el diccionario la vuelve deterministica.
-- Separada de la creacion de la extension por la razon explicada alli.
-- ===========================================================================

CREATE OR REPLACE FUNCTION inmutable_unaccent(texto text)
RETURNS text AS $$
  SELECT unaccent('unaccent'::regdictionary, texto)
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;
