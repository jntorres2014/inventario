#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="${1:-$(hostname -I | awk '{print $1}')}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_DIR}"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt
fi

if [[ ! -f certs/server.crt || ! -f certs/server.key ]]; then
  chmod +x scripts/create-local-cert.sh
  ./scripts/create-local-cert.sh "${SERVER_IP}"
fi

echo "Comparador Ubuntu: https://${SERVER_IP}:8443/"
echo "Instalador móvil:  https://${SERVER_IP}:8443/mobile/"
.venv/bin/python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8443 \
  --ssl-keyfile certs/server.key \
  --ssl-certfile certs/server.crt

