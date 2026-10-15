-- ===========================================================================
-- El numero de contrato deja de ser unico por si solo
-- ---------------------------------------------------------------------------
-- Las revisiones de un mismo contrato comparten numero (CT-2026-00001) y se
-- distinguen por la version. Con `numero` UNIQUE, regenerar un contrato
-- fallaba con "Ya existe un registro con el mismo valor en: numero".
--
-- La unicidad real es la pareja (numero, version).
-- ===========================================================================

DROP INDEX IF EXISTS "contratos_numero_key";

CREATE UNIQUE INDEX IF NOT EXISTS "contratos_numero_version_key"
  ON contratos (numero, version);

CREATE INDEX IF NOT EXISTS "contratos_numero_idx" ON contratos (numero);
