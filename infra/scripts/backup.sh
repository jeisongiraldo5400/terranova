#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Respaldo de la base de datos.
#
# Las carpetas backup/ y Respaldo/ del sistema anterior existian vacias: no
# habia ningun respaldo real y los datos vivian solo en el localStorage de
# cada navegador. Este script les da contenido.
#
# Programelo con cron, por ejemplo cada noche a la 1:
#   0 1 * * * /ruta/terranova/infra/scripts/backup.sh >> /var/log/terranova-backup.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Opcional: sin infra/.env se usan los mismos valores por defecto que compose.
[ -f "$RAIZ/infra/.env" ] && { set -a; . "$RAIZ/infra/.env"; set +a; }

DESTINO="$RAIZ/infra/backups"
RETENER_DIAS="${BACKUP_RETENER_DIAS:-30}"
SELLO="$(date +%Y%m%d-%H%M%S)"
ARCHIVO="$DESTINO/terranova-$SELLO.sql.gz"

mkdir -p "$DESTINO"

echo "[$(date -Iseconds)] Iniciando respaldo…"

# --clean --if-exists deja un volcado que se puede restaurar sobre una base
# existente sin borrarla antes a mano.
docker exec terranova-postgres pg_dump \
  -U "${POSTGRES_USER:-terranova}" \
  -d "${POSTGRES_DB:-terranova}" \
  --clean --if-exists --no-owner \
  | gzip -9 > "$ARCHIVO"

TAMANO="$(du -h "$ARCHIVO" | cut -f1)"
echo "[$(date -Iseconds)] Respaldo listo: $(basename "$ARCHIVO") ($TAMANO)"

# Verificacion: un volcado que no se puede descomprimir no es un respaldo.
if ! gzip -t "$ARCHIVO"; then
  echo "[$(date -Iseconds)] ERROR: el archivo esta corrupto" >&2
  rm -f "$ARCHIVO"
  exit 1
fi

# Los contratos PDF no estan en la base: se respaldan aparte.
if [ -d "$RAIZ/apps/api/contratos" ]; then
  tar -czf "$DESTINO/contratos-$SELLO.tar.gz" -C "$RAIZ/apps/api" contratos
  echo "[$(date -Iseconds)] Contratos archivados"
fi

# Rotacion
BORRADOS="$(find "$DESTINO" -name 'terranova-*.sql.gz' -mtime "+$RETENER_DIAS" -print -delete | wc -l | tr -d ' ')"
find "$DESTINO" -name 'contratos-*.tar.gz' -mtime "+$RETENER_DIAS" -delete
[ "$BORRADOS" -gt 0 ] && echo "[$(date -Iseconds)] $BORRADOS respaldo(s) antiguo(s) eliminado(s)"

echo "[$(date -Iseconds)] Respaldos vigentes: $(find "$DESTINO" -name 'terranova-*.sql.gz' | wc -l | tr -d ' ')"
