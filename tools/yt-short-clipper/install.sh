#!/usr/bin/env bash
# Install yt-short-clipper (https://github.com/jipraks/yt-short-clipper) on Linux/macOS.
#
# The upstream project is a Windows Tauri desktop app. This script installs the
# parts that are cross-platform: the React frontend and the Python processing
# core (yt_short_clipper_core). See INSTALL.md for what is Windows-only.
#
# Usage: ./install.sh [target-dir]     (default: ./yt-short-clipper)

set -euo pipefail

REPO_URL="https://github.com/jipraks/yt-short-clipper.git"
TARGET="${1:-$(pwd)/yt-short-clipper}"
VENV="$TARGET/.venv"

log() { printf '\n\033[1m[install]\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m[install] %s\033[0m\n' "$*" >&2; exit 1; }

# --- prerequisites ---------------------------------------------------------
command -v git >/dev/null  || die "git is required"
command -v node >/dev/null || die "Node.js v18+ is required (found none)"
command -v npm >/dev/null  || die "npm is required"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js v18+ required, found $(node -v)"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || die "python3 is required (set PYTHON=... to override)"
"$PY" - <<'PYEOF' || die "Python 3.11+ required"
import sys
sys.exit(0 if sys.version_info >= (3, 11) else 1)
PYEOF

if ! command -v ffmpeg >/dev/null; then
  echo "[install] WARNING: ffmpeg not found on PATH."
  echo "          The clipping pipeline needs it (apt install ffmpeg / brew install ffmpeg)."
fi
if ! command -v deno >/dev/null; then
  echo "[install] NOTE: deno not found on PATH. It is optional — yt-dlp uses it to"
  echo "          solve YouTube JS challenges when a download is refused."
fi

# --- source ----------------------------------------------------------------
if [ -d "$TARGET/.git" ]; then
  log "Updating existing checkout at $TARGET"
  git -C "$TARGET" pull --ff-only
else
  log "Cloning $REPO_URL into $TARGET"
  git clone "$REPO_URL" "$TARGET"
fi

# --- python core -----------------------------------------------------------
log "Creating virtualenv at $VENV"
"$PY" -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip
log "Installing Python dependencies (yt-dlp, opencv, mediapipe, openai, ...)"
"$VENV/bin/pip" install -r "$TARGET/requirements.txt"

log "Smoke-testing the Python core"
(cd "$TARGET" && "$VENV/bin/python" -c "import yt_short_clipper_core.sidecar, yt_short_clipper_core.cli; print('core OK')")

# --- frontend --------------------------------------------------------------
log "Installing npm dependencies"
(cd "$TARGET" && npm install)
log "Building the frontend"
(cd "$TARGET" && npm run build)

cat <<EOM

[install] Done. Installed at: $TARGET

  Frontend dev server : cd "$TARGET" && npm run dev
  Python core (CLI)   : cd "$TARGET" && "$VENV/bin/python" -m yt_short_clipper_core.cli get_subtitles <url> <cookies.txt>
  Python sidecar      : cd "$TARGET" && "$VENV/bin/python" -m yt_short_clipper_core.sidecar   (JSON-lines on stdin)

  The Tauri desktop shell is Windows-only — see INSTALL.md.
EOM
