#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Dos guardas que este proyecto necesita, derivadas de bugs reales del v0:
#
#   1. Colisiones de mayusculas. pages/Clientes.jsx importaba
#      "../components/clientes/..." mientras la carpeta era "Clientes/".
#      Funciona en macOS (sistema de archivos insensible) y rompe en Linux,
#      es decir, en CI y en el servidor.
#
#   2. Caracteres no ASCII en rutas. La carpeta "diseño" con ñ causa
#      problemas en herramientas y en algunos sistemas de archivos.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

fallos=0

echo "Verificando colisiones de mayusculas y minusculas…"
colisiones="$(git ls-files | sort -f | uniq -di || true)"
if [ -n "$colisiones" ]; then
  echo "  ERROR: rutas que colisionan al ignorar mayusculas:" >&2
  echo "$colisiones" | sed 's/^/    /' >&2
  fallos=1
else
  echo "  OK"
fi

echo "Verificando caracteres no ASCII en rutas…"
noascii="$(git ls-files | LC_ALL=C grep -n '[^ -~]' || true)"
if [ -n "$noascii" ]; then
  echo "  ERROR: rutas con caracteres no ASCII:" >&2
  echo "$noascii" | sed 's/^/    /' >&2
  fallos=1
else
  echo "  OK"
fi

exit "$fallos"
