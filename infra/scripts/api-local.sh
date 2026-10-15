#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Arranca o detiene la API compilada en segundo plano, para pruebas manuales.
#
# Identifica el proceso por el puerto que escucha, no por el patron de la
# linea de comandos: `node dist/main.js` no contiene la ruta del paquete, de
# modo que un `pkill -f apps/api` no lo encuentra y deja corriendo una
# version vieja del codigo.
#
#   ./infra/scripts/api-local.sh start|stop|restart|status
# ---------------------------------------------------------------------------
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
set -a; . "$RAIZ/.env"; set +a
PUERTO="${API_PORT:-3101}"
LOG="${TMPDIR:-/tmp}/terranova-api.log"

pid_en_puerto() { lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN -t 2>/dev/null || true; }

detener() {
  local pid; pid="$(pid_en_puerto)"
  if [ -n "$pid" ]; then
    kill "$pid"
    for _ in $(seq 20); do [ -z "$(pid_en_puerto)" ] && break; sleep 0.3; done
    echo "API detenida (pid $pid)"
  else
    echo "No habia API en el puerto $PUERTO"
  fi
}

arrancar() {
  if [ -n "$(pid_en_puerto)" ]; then
    echo "El puerto $PUERTO ya esta ocupado. Use 'restart' o cambie API_PORT." >&2
    exit 1
  fi
  ( cd "$RAIZ/apps/api" && nohup node dist/main.js > "$LOG" 2>&1 & )
  for _ in $(seq 40); do
    curl -sf "http://localhost:$PUERTO/api/salud" >/dev/null 2>&1 && break
    sleep 0.5
  done
  if curl -sf "http://localhost:$PUERTO/api/salud" >/dev/null 2>&1; then
    echo "API lista en http://localhost:$PUERTO/api  (log: $LOG)"
  else
    echo "La API no respondio. Ultimas lineas del log:" >&2
    tail -20 "$LOG" >&2
    exit 1
  fi
}

case "${1:-status}" in
  start)   arrancar ;;
  stop)    detener ;;
  restart) detener; arrancar ;;
  status)
    pid="$(pid_en_puerto)"
    [ -n "$pid" ] && echo "API corriendo (pid $pid, puerto $PUERTO)" || echo "API detenida"
    ;;
  *) echo "Uso: $0 start|stop|restart|status" >&2; exit 1 ;;
esac
