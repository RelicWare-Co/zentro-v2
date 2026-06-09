<#
.SYNOPSIS
  Generates a self-signed QZ Tray signing pair (private key + certificate).

.DESCRIPTION
  Produces, into qz/certs/:
    - private-key.pem        PKCS#8 RSA key used by the server to sign requests.
    - digital-certificate.txt  X.509 certificate served to the browser and
                               trusted by QZ Tray for silent printing.
    - public-key.txt         X.509 public key (only needed to request certs).

  Requires OpenSSL on PATH (Git for Windows ships it at
  "C:\Program Files\Git\usr\bin\openssl.exe").

.EXAMPLE
  ./qz/generate-certs.ps1 -Subject "/CN=Zentro POS/O=Mi Empresa/C=CO"
#>

param(
  [string]$Subject = "/CN=Zentro POS/O=Zentro/OU=POS/C=CO",
  [int]$Days = 7300
)

$ErrorActionPreference = "Stop"

$openssl = $null
$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue
if ($opensslCmd) {
  $openssl = $opensslCmd.Source
}
if (-not $openssl) {
  $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
  if (Test-Path $gitOpenssl) {
    $openssl = $gitOpenssl
  } else {
    throw "OpenSSL no encontrado en PATH. Instala Git for Windows o OpenSSL."
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certsDir = Join-Path $scriptDir "certs"
New-Item -ItemType Directory -Force -Path $certsDir | Out-Null

$keyTmp = Join-Path $certsDir "private-key.traditional.pem"
$keyPath = Join-Path $certsDir "private-key.pem"
$certPath = Join-Path $certsDir "digital-certificate.txt"
$pubPath = Join-Path $certsDir "public-key.txt"

Write-Host "Generando llave y certificado autofirmado (SHA-512, RSA 2048)..." -ForegroundColor Cyan

# Self-signed certificate + RSA key (unencrypted).
& $openssl req -x509 -newkey rsa:2048 -keyout $keyTmp -out $certPath `
  -days $Days -sha512 -nodes -subj $Subject
if ($LASTEXITCODE -ne 0) { throw "openssl req falló" }

# Convert key to PKCS#8 (what QZ documents and node:crypto reads cleanly).
& $openssl pkcs8 -topk8 -nocrypt -in $keyTmp -out $keyPath
if ($LASTEXITCODE -ne 0) { throw "openssl pkcs8 falló" }
Remove-Item $keyTmp -Force

# Optional public key (used only to request CA-signed certs later).
& $openssl x509 -in $certPath -pubkey -noout | Out-File -Encoding ascii $pubPath

Write-Host ""
Write-Host "Listo. Archivos generados en: $certsDir" -ForegroundColor Green
Write-Host "  private-key.pem           (SECRETO - solo en el servidor)"
Write-Host "  digital-certificate.txt   (publico - lo sirve la app y lo confia QZ Tray)"
Write-Host "  public-key.txt"
Write-Host ""
Write-Host "Siguientes pasos: ver qz/README.md" -ForegroundColor Yellow
