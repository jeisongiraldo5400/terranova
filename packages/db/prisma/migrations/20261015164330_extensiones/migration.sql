-- ===========================================================================
-- Extensiones de Postgres y funciones base
-- ---------------------------------------------------------------------------
-- Van en una migracion propia porque Postgres analiza el lote completo de
-- sentencias antes de ejecutar la primera: un cast ::regdictionary en la
-- misma migracion que crea la extension falla con
--   ERROR: text search dictionary "unaccent" does not exist
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
