#!/usr/bin/env bash
# Arranca o detiene el frontend compilado. Identifica el proceso por el
# puerto, igual que api-local.sh y por la misma razon.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUERTO=3100
LOG="${TMPDIR:-/tmp}/terranova-web.log"

pid_en_puerto() { lsof -nP -iTCP:"$PUERTO" -sTCP:LISTEN -t 2>/dev/null || true; }

detener() {
  local pid; pid="$(pid_en_puerto)"
  if [ -n "$pid" ]; then kill $pid 2>/dev/null || true
    for _ in $(seq 20); do [ -z "$(pid_en_puerto)" ] && break; sleep 0.3; done
    echo "Web detenida"
  else echo "No habia web en el puerto $PUERTO"; fi
}

arrancar() {
  [ -n "$(pid_en_puerto)" ] && { echo "Puerto $PUERTO ocupado" >&2; exit 1; }
  ( cd "$RAIZ/apps/web" && nohup pnpm run start > "$LOG" 2>&1 & )
  for _ in $(seq 60); do curl -sf "http://localhost:$PUERTO/login" >/dev/null 2>&1 && break; sleep 0.5; done
  if curl -sf "http://localhost:$PUERTO/login" >/dev/null 2>&1; then
    echo "Web lista en http://localhost:$PUERTO  (log: $LOG)"
  else echo "La web no respondio:" >&2; tail -20 "$LOG" >&2; exit 1; fi
}

case "${1:-status}" in
  start) arrancar ;; stop) detener ;; restart) detener; arrancar ;;
  status) pid="$(pid_en_puerto)"; [ -n "$pid" ] && echo "Web corriendo (pid $pid)" || echo "Web detenida" ;;
  *) echo "Uso: $0 start|stop|restart|status" >&2; exit 1 ;;
esac
