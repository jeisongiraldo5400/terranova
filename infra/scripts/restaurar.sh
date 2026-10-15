#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Restaura un respaldo. Pide confirmacion explicita porque sobreescribe la
# base de datos actual.
#
#   ./infra/scripts/restaurar.sh infra/backups/terranova-20261015-010000.sql.gz
# ---------------------------------------------------------------------------
set -euo pipefail

ARCHIVO="${1:?Uso: restaurar.sh <archivo.sql.gz>}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
set -a; . "$RAIZ/.env"; set +a

[ -f "$ARCHIVO" ] || { echo "No existe: $ARCHIVO" >&2; exit 1; }
gzip -t "$ARCHIVO" || { echo "El archivo esta corrupto: $ARCHIVO" >&2; exit 1; }

echo "Se va a SOBREESCRIBIR la base '${POSTGRES_DB:-terranova}' con:"
echo "  $ARCHIVO"
echo
read -r -p "Escriba SI para continuar: " respuesta
[ "$respuesta" = "SI" ] || { echo "Cancelado."; exit 1; }

gunzip -c "$ARCHIVO" | docker exec -i terranova-postgres psql \
  -U "${POSTGRES_USER:-terranova}" -d "${POSTGRES_DB:-terranova}"

echo "Restauracion terminada."
