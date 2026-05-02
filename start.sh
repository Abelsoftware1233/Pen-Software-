#!/usr/bin/env bash
# PentestKit Pro – Launcher
set -e

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║         PentestKit Pro v1.0              ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "  [!] Python 3 not found. Please install Python 3.8+"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Virtual environment
if [ ! -d "venv" ]; then
  echo "  [*] Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate

# Install deps
echo "  [*] Installing dependencies..."
pip install -q -r requirements.txt

# Launch
echo "  [*] Starting server on http://localhost:5000"
echo "  [*] Press Ctrl+C to stop"
echo ""
python3 app.py
