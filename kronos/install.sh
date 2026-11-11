#!/usr/bin/env bash
# Install Kronos (https://github.com/shiyu-coder/Kronos), an open-source
# foundation model for financial candlesticks (K-lines).
#
# Usage:  ./install.sh [target-dir]        (default: ./Kronos next to this script)
#
# Creates <target-dir>/.venv with all dependencies, then runs the upstream
# CPU regression suite to prove the install works.

set -euo pipefail

REPO_URL="https://github.com/shiyu-coder/Kronos.git"
# Pinned so the install is reproducible. Bump deliberately after re-verifying.
REPO_COMMIT="67b630e67f6a18c9e9be918d9b4337c960db1e9a"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$SCRIPT_DIR/Kronos}"

# Kronos requires Python 3.10+.
PYTHON="${PYTHON:-python3}"
"$PYTHON" - <<'PY'
import sys
if sys.version_info < (3, 10):
    sys.exit(f"Kronos needs Python 3.10+, found {sys.version.split()[0]}")
PY

echo "==> Cloning Kronos into $TARGET_DIR"
if [ -d "$TARGET_DIR/.git" ]; then
    echo "    already present, fetching pinned commit"
    git -C "$TARGET_DIR" fetch --depth 1 origin "$REPO_COMMIT"
else
    git clone --filter=blob:none "$REPO_URL" "$TARGET_DIR"
fi
git -C "$TARGET_DIR" checkout --quiet "$REPO_COMMIT"

echo "==> Creating virtualenv at $TARGET_DIR/.venv"
"$PYTHON" -m venv "$TARGET_DIR/.venv"
PIP="$TARGET_DIR/.venv/bin/pip"
"$PIP" install --quiet --upgrade pip

# Install torch first from the CPU wheel index. The default PyPI wheel pulls
# ~2.5GB of bundled CUDA libraries that are dead weight without a GPU.
# Drop KRONOS_CPU_ONLY=0 into the environment on a GPU box to use stock wheels.
if [ "${KRONOS_CPU_ONLY:-1}" = "1" ]; then
    echo "==> Installing PyTorch (CPU-only wheels)"
    "$PIP" install --index-url https://download.pytorch.org/whl/cpu "torch>=2.0.0"
else
    echo "==> Installing PyTorch (default wheels, CUDA included)"
    "$PIP" install "torch>=2.0.0"
fi

echo "==> Installing Kronos requirements"
"$PIP" install -r "$TARGET_DIR/requirements.txt"

echo "==> Verifying install"
"$PIP" install --quiet pytest
# The upstream suite pins its own checkpoint revisions and asserts exact MSE
# values, so a pass confirms both the deps and the downloaded weights.
(cd "$TARGET_DIR" && "$TARGET_DIR/.venv/bin/python" -m pytest tests/test_kronos_regression.py -q)
"$TARGET_DIR/.venv/bin/python" "$SCRIPT_DIR/verify_install.py" "$TARGET_DIR"

cat <<EOF

Kronos installed at $TARGET_DIR
Activate with:  source $TARGET_DIR/.venv/bin/activate
EOF
