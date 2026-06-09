#!/usr/bin/env bash
#
# Generates a self-signed QZ Tray signing pair (private key + certificate).
#
# Produces, into qz/certs/:
#   private-key.pem          PKCS#8 RSA key used by the server to sign requests.
#   digital-certificate.txt  X.509 certificate served to the browser and trusted
#                            by QZ Tray for silent printing.
#   public-key.txt           X.509 public key (only needed to request certs).
#
# Usage:
#   ./qz/generate-certs.sh ["/CN=Zentro POS/O=Mi Empresa/C=CO"] [days]

set -euo pipefail

SUBJECT="${1:-/CN=Zentro POS/O=Zentro/OU=POS/C=CO}"
DAYS="${2:-7300}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL no encontrado en PATH. Instálalo e inténtalo de nuevo." >&2
  exit 1
fi

# On Git Bash / MSYS (Windows), the leading "/" of -subj is mangled into a
# Windows path. Exclude exactly the subject string from path conversion while
# leaving file-path arguments converted normally. Harmless on macOS/Linux.
export MSYS2_ARG_CONV_EXCL="$SUBJECT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
mkdir -p "$CERTS_DIR"

KEY_TMP="$CERTS_DIR/private-key.traditional.pem"
KEY_PATH="$CERTS_DIR/private-key.pem"
CERT_PATH="$CERTS_DIR/digital-certificate.txt"
PUB_PATH="$CERTS_DIR/public-key.txt"

echo "Generando llave y certificado autofirmado (SHA-512, RSA 2048)..."

openssl req -x509 -newkey rsa:2048 -keyout "$KEY_TMP" -out "$CERT_PATH" \
  -days "$DAYS" -sha512 -nodes -subj "$SUBJECT"

# Convert key to PKCS#8 (what QZ documents and node:crypto reads cleanly).
openssl pkcs8 -topk8 -nocrypt -in "$KEY_TMP" -out "$KEY_PATH"
rm -f "$KEY_TMP"

# Optional public key (used only to request CA-signed certs later).
openssl x509 -in "$CERT_PATH" -pubkey -noout >"$PUB_PATH"

echo ""
echo "Listo. Archivos generados en: $CERTS_DIR"
echo "  private-key.pem           (SECRETO - solo en el servidor)"
echo "  digital-certificate.txt   (publico - lo sirve la app y lo confia QZ Tray)"
echo "  public-key.txt"
echo ""
echo "Siguientes pasos: ver qz/README.md"
