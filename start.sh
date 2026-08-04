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

# Launch with correct binding for port 8080 and external traffic
echo "  [*] Starting server on http://0.0.0.0:8080 (pen.abelsoftware123.com)"
echo "  [*] Press Ctrl+C to stop"
echo ""
python3 -c "from app import app; app.run(host='0.0.0.0', port=8080)"
