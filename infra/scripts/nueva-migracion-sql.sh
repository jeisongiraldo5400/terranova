#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Crea una migracion de Prisma a partir de los archivos de packages/db/prisma/sql.
#
# Las invariantes y vistas se escriben en prisma/sql/ (legibles, idempotentes)
# y desde alli se congelan en una migracion versionada. Evita que la migracion
# aplicada y el SQL de referencia se separen.
#
#   ./infra/scripts/nueva-migracion-sql.sh ajuste_vista_cartera
# ---------------------------------------------------------------------------
set -euo pipefail

NOMBRE="${1:?Uso: nueva-migracion-sql.sh <nombre_descriptivo>}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="$RAIZ/packages/db"
TS="$(date -u +%Y%m%d%H%M%S)"
DIR="$DB/prisma/migrations/${TS}_${NOMBRE}"

mkdir -p "$DIR"
{
  echo "-- Generado desde prisma/sql/ por infra/scripts/nueva-migracion-sql.sh"
  echo "-- No editar a mano: modifique los archivos de prisma/sql/ y regenere."
  echo
  for f in "$DB"/prisma/sql/*.sql; do
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
    echo
  done
} > "$DIR/migration.sql"

echo "Migracion creada: $DIR/migration.sql"
echo "Aplicar con: pnpm db:deploy"
