#!/bin/bash
# ============================================================
# SysAI - Setup binari per scan integrati
# 
# Questo script scarica e prepara ssh-audit per l'inclusione
# nel pacchetto .deb/.rpm
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"

echo "╔══════════════════════════════════════╗"
echo "║  SysAI - Setup scanner binaries      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Crea cartella bin/
mkdir -p "$BIN_DIR"

# ============================================================
# SSH-AUDIT
# ============================================================
echo "[1/2] Scaricamento ssh-audit..."

SSH_AUDIT_VERSION="3.3.0"
SSH_AUDIT_URL="https://github.com/jtesta/ssh-audit/releases/download/v${SSH_AUDIT_VERSION}/ssh-audit-${SSH_AUDIT_VERSION}.tar.gz"

# Scarica e estrai
cd /tmp
if [ -f "ssh-audit-${SSH_AUDIT_VERSION}.tar.gz" ]; then
    echo "  → File già presente, riuso..."
else
    wget -q --show-progress "$SSH_AUDIT_URL" -O "ssh-audit-${SSH_AUDIT_VERSION}.tar.gz"
fi

tar xzf "ssh-audit-${SSH_AUDIT_VERSION}.tar.gz"

# Copia lo script Python (è un singolo file!)
cp "ssh-audit-${SSH_AUDIT_VERSION}/ssh-audit" "$BIN_DIR/ssh-audit"
chmod +x "$BIN_DIR/ssh-audit"

echo "  ✓ ssh-audit ${SSH_AUDIT_VERSION} installato"

# Pulizia
rm -rf "/tmp/ssh-audit-${SSH_AUDIT_VERSION}" "/tmp/ssh-audit-${SSH_AUDIT_VERSION}.tar.gz"

# ============================================================
# VERIFICA
# ============================================================
echo ""
echo "[2/2] Verifica installazione..."
echo ""

if [ -x "$BIN_DIR/ssh-audit" ]; then
    echo "  ✓ bin/ssh-audit    $(du -h "$BIN_DIR/ssh-audit" | cut -f1)"
    
    # Test rapido
    if python3 "$BIN_DIR/ssh-audit" --help > /dev/null 2>&1; then
        echo "    → Funziona con python3 ✓"
    else
        echo "    ⚠ python3 non trovato - ssh-audit richiede Python 3.6+"
        echo "    → Installa con: sudo apt install python3"
    fi
else
    echo "  ✗ ssh-audit non trovato!"
fi

echo ""
echo "════════════════════════════════════════"
echo "  Nota: Port scan e TLS check sono"
echo "  integrati in Node.js (nessun binario"
echo "  esterno necessario)"
echo "════════════════════════════════════════"
echo ""
echo "Fatto! Ora puoi buildare con:"
echo "  npm run electron:build:all"
echo ""
