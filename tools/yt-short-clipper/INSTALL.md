# Installing yt-short-clipper

Setup notes for [jipraks/yt-short-clipper](https://github.com/jipraks/yt-short-clipper)
(YT Short Clipper v2, MIT © Aji Prakoso) — a desktop app that turns long YouTube
videos into 9:16 shorts with AI highlight detection, face-tracking reframe and
word-by-word captions.

The app is built as three layers, and they do **not** all install on every OS:

| Layer | Stack | Linux / macOS | Windows |
| --- | --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite | ✅ installs and builds | ✅ |
| Processing core | Python 3.11+ (`yt_short_clipper_core`) | ✅ installs and imports | ✅ |
| Desktop shell + packaging | Tauri v2 (Rust) + PowerShell scripts | ❌ Windows-only | ✅ |

The Windows-only part is not a soft limitation: `scripts/*.ps1` are PowerShell,
`npm run build:sidecar` / `deps` / `package` / `release` all shell out to
`powershell`, and `src-tauri/tauri.conf.json` bundles `ffmpeg.exe`, `deno.exe`
and an `.exe` sidecar as resources. The Python core itself is written
cross-platform (every `sys.platform == "win32"` branch has a non-Windows
fallback), so the pipeline runs headless off-Windows via the CLI/sidecar.

## Windows (full desktop app — upstream's supported path)

Prerequisites: Node.js v18+, Rust (stable), Python 3.13+, Windows 10/11 with
PowerShell.

```powershell
git clone https://github.com/jipraks/yt-short-clipper.git
cd yt-short-clipper
npm install
py -m pip install -r requirements.txt
powershell -ExecutionPolicy Bypass -File scripts/fetch-deps.ps1   # ffmpeg + deno + face model
npm run build:sidecar                                             # freezes the Python sidecar with PyInstaller
npm run tauri dev                                                 # or: npm run release
```

`fetch-deps.ps1` is idempotent (pass `-Force` to re-download). It pins ffmpeg to
the gyan.dev GnuTLS build on purpose — the BtbN Schannel builds hang forever on
yt-dlp's DASH range downloads.

Editing Python and want the change picked up without a full rebuild: delete
`src-tauri/binaries/ytclip-sidecar-*.exe` and the app falls back to your source.

## Linux / macOS (frontend + Python core, no desktop shell)

```bash
tools/yt-short-clipper/install.sh [target-dir]     # default: ./yt-short-clipper
```

The script checks prerequisites, clones (or fast-forwards) the repo, creates a
`.venv`, installs `requirements.txt`, smoke-tests the core imports, then runs
`npm install` and `npm run build`. Re-running it is safe.

Manual equivalent:

```bash
git clone https://github.com/jipraks/yt-short-clipper.git && cd yt-short-clipper
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm install && npm run build
```

Runtime dependencies to install yourself (the PowerShell fetcher won't run):

- **ffmpeg** — required. `apt install ffmpeg` / `brew install ffmpeg`. The core
  resolves the bundled binary first, then falls back to `PATH`.
- **deno** — optional. Only used to let yt-dlp solve YouTube JS challenges.
- **face_landmarker.task** — nothing to do. If it isn't bundled,
  `get_face_landmarker_model_path()` downloads it from Google's MediaPipe
  storage and caches it in the app data dir on first use.

Using the core headlessly:

```bash
.venv/bin/python -m yt_short_clipper_core.cli get_subtitles <youtube-url> <cookies.txt>
.venv/bin/python -m yt_short_clipper_core.sidecar   # JSON-lines requests on stdin
```

## Configuration

- **YouTube cookies are mandatory.** Export `cookies.txt` with the "Get
  cookies.txt LOCALLY" browser extension; yt-dlp needs it to fetch videos and
  subtitles.
- **An OpenAI-compatible endpoint** is needed for highlight detection — any
  base URL + API key that speaks the OpenAI chat API.
- Repliz upload integration is optional and only used if you configure it.

## Verified in this session (Linux x86_64, Ubuntu 24.04)

Everything below was actually run, not just transcribed from the README:

- Toolchain present: Node v22.22.2, npm 10.9.7, Python 3.11.15, Rust 1.94.1;
  ffmpeg 6.1.1 installed via apt.
- `npm install` — clean (5 advisories reported by `npm audit`, none blocking).
- `npm run build` — `tsc -b && vite build` succeeded, 1720 modules,
  `dist/assets/index-*.js` 471 kB (136 kB gzipped).
- `pip install -r requirements.txt` — succeeded on Python 3.11 with yt-dlp
  2026.8.19, mediapipe 1.0.1, opencv-python 5.0.0.93, openai 3.3.1,
  numpy 2.4.6, pyinstaller 6.22.2.
- `import yt_short_clipper_core.sidecar, yt_short_clipper_core.cli` — OK, and
  the CLI returns its usage JSON when invoked with no arguments.

Not exercised here: `npm run tauri build/dev` (needs Windows for the bundled
`.exe` resources, and there's no display in a container), and any real clipping
run (needs YouTube cookies and an LLM endpoint).
