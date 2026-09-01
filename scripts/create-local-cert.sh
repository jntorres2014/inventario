#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="${1:-$(hostname -I | awk '{print $1}')}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${PROJECT_DIR}/certs"

if [[ -z "${SERVER_IP}" ]]; then
  echo "No se pudo detectar la IP. Ejecutá: ./scripts/create-local-cert.sh 192.168.50.10"
  exit 1
fi

mkdir -p "${CERT_DIR}"
chmod 700 "${CERT_DIR}"

openssl req -x509 -newkey rsa:3072 -nodes \
  -keyout "${CERT_DIR}/inventory-ca.key" \
  -out "${CERT_DIR}/inventory-ca.crt" \
  -days 3650 \
  -subj "/CN=Inventario Local CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

openssl req -newkey rsa:3072 -nodes \
  -keyout "${CERT_DIR}/server.key" \
  -out "${CERT_DIR}/server.csr" \
  -subj "/CN=inventario.local"

openssl x509 -req \
  -in "${CERT_DIR}/server.csr" \
  -CA "${CERT_DIR}/inventory-ca.crt" \
  -CAkey "${CERT_DIR}/inventory-ca.key" \
  -CAcreateserial \
  -out "${CERT_DIR}/server.crt" \
  -days 825 \
  -sha256 \
  -extfile <(printf "subjectAltName=IP:%s,DNS:inventario.local\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n" "${SERVER_IP}")

chmod 600 "${CERT_DIR}"/*.key
echo "Certificados creados para ${SERVER_IP}"
echo "Instalá certs/inventory-ca.crt en el teléfono antes de abrir la PWA."

