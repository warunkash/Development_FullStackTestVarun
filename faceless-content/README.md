# Autonomous Faceless Content

Produces and publishes faceless short-form videos without a human in the loop.
Each run finds what people are actually viewing right now, writes narration for
it, voices it, builds visuals and burned-in captions, renders a 1080x1920 MP4,
and posts it to YouTube Shorts, TikTok and Instagram Reels.

```
discover -> script -> voiceover -> visuals -> captions -> render -> publish
```

Every stage has a fallback, so a missing API key degrades the output instead of
stopping the run. With no keys at all it still produces a complete, playable
video using local text-to-speech and generated gradient backgrounds.

## How it works

### 1. Discovery — "most viewed", measured rather than guessed

Four public sources are queried in parallel, each contributing candidates with a
raw popularity metric:

| Source | Metric | Key needed |
|---|---|---|
| Wikipedia | yesterday's article pageviews | no (optional, see below) |
| Google Trends | approximate search volume | no |
| Reddit | upvotes on today's top posts | no |
| Hacker News | front-page points | no |
| YouTube | `mostPopular` chart view counts | `YOUTUBE_API_KEY` |

Those metrics are not comparable — a Wikipedia pageview and a Reddit upvote are
different units — so each source is normalised against **its own** peak, then
weighted. Topics are deduplicated by a stopword-stripped, order-insensitive key
("The Rise of a New Octopus!" and "octopus rise new" collapse together), and a
topic that several independent sources surfaced is boosted, because cross-source
agreement is the strongest available evidence that something is genuinely being
looked at rather than amplified by one platform.

A failing source is logged and skipped. Discovery only fails if *every* source
fails.

### 2. Brand safety

Trending feeds surface whatever is spiking, which regularly means a shooting, a
death or a disaster. Since nothing here is reviewed before it goes out, every
candidate is screened against a category blocklist (death, violence, conflict,
disaster, self-harm, abuse, medical claims, explicit, elections) before anything
is written about it.

The patterns deliberately over-block — "the die is cast" trips the obituary rule
— because discovery returns a ranked *list*: skipping a usable topic costs one
list position, while publishing over a tragedy cannot be undone. Add your own
terms with `blocklist_extra`.

### 3. Script

`claude-opus-5` writes the narration through the Messages API, constrained to a
JSON schema (hook, beats, CTA, hashtags, per-beat stock-footage queries) and
budgeted to the target duration. Without `ANTHROPIC_API_KEY` a deterministic
template writer reshapes the source summary instead, so the pipeline stays
runnable.

### 4. Voice, visuals, captions, render

- **Voice** — ElevenLabs, then OpenAI, then local `espeak-ng`.
- **Visuals** — Pexels stock footage, falling back to animated gradients
  generated locally by ffmpeg. One clip per beat.
- **Captions** — the narration is chunked to caption width and timed by weight:
  longer text, and text with more punctuation, gets proportionally more time.
  Rendered as ASS and burned in.
- **Render** — each clip becomes a segment of exactly its beat's duration
  (looped if the source is shorter), joined with the concat demuxer, then
  captions burned and speech loudness-normalised over optional music.

### 5. Publish

| Platform | Mechanism | Credentials |
|---|---|---|
| YouTube Shorts | Data API v3 resumable upload | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` |
| TikTok | Content Posting API, direct post | `TIKTOK_ACCESS_TOKEN` |
| Instagram Reels | Graph API container + publish | `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` |

One target failing never blocks the others. A vertical video under three
minutes is treated as a Short by YouTube automatically.

**Publishing is opt-in twice**: the platform must be listed in
`publish.targets` *and* the run must pass `--publish`. Without the flag the
video is still fully rendered — a dry run rehearses everything except the
irreversible step, and does not consume the topic, so it stays repeatable.

## Setup

```bash
cd faceless-content
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

System dependencies:

```bash
# Debian/Ubuntu
sudo apt-get install -y ffmpeg espeak-ng
# macOS
brew install ffmpeg espeak-ng
```

`ffmpeg` is required. `espeak-ng` is only needed if you have no cloud TTS key.

Check what your machine can actually do:

```bash
python -m faceless_content.cli doctor
```

```
binaries:
  ffmpeg     /usr/bin/ffmpeg
  ffprobe    /usr/bin/ffprobe
script writer:
  template fallback (set ANTHROPIC_API_KEY for model-written scripts)
voice backends: espeak
visuals providers: gradient
discovery sources: wikipedia, google_trends, reddit, hacker_news
publish targets:
  (none configured - render only)

ready to run
```

## Usage

```bash
# What would it pick right now?
python -m faceless_content.cli trends -n 15

# Render one video from the top-ranked topic (no publishing)
python -m faceless_content.cli run

# Force a topic
python -m faceless_content.cli run --topic "Why the ocean is salty" \
    --summary "Rivers carry dissolved salt to the sea; water evaporates, salt stays."

# Render and actually post
python -m faceless_content.cli -c config.yaml run --publish
```

Each run writes `output/YYYYMMDD-<slug>/` containing the MP4, the voiceover,
the caption file, the source clips and a `metadata.json` with the script,
scores, sources and publish results.

## Configuration

Copy `config.example.yaml` to `config.yaml` and edit. Anything omitted keeps its
default. Secrets stay in the environment — `${VAR}` and `${VAR:-default}` are
expanded on load. Unknown keys are rejected with the section they appeared in,
so a typo fails immediately rather than being silently ignored.

## Environment variables

| Variable | Effect if unset |
|---|---|
| `ANTHROPIC_API_KEY` | template script writer instead of the model |
| `ELEVENLABS_API_KEY` / `OPENAI_API_KEY` | falls back to local `espeak-ng` |
| `PEXELS_API_KEY` | gradient backgrounds instead of stock footage |
| `YOUTUBE_API_KEY` | the YouTube chart source is skipped |
| `WIKIMEDIA_ACCESS_TOKEN` | anonymous Wikipedia rate limit (see below) |
| `YOUTUBE_*`, `TIKTOK_*`, `INSTAGRAM_*` | that platform is skipped with a reason (see below for YouTube) |

## Getting a YouTube refresh token

Uploading needs three secrets: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` and
`YOUTUBE_REFRESH_TOKEN`. The first two come from the Google Cloud console; the
third comes from authorising your channel once.

### In the Google Cloud console

1. Create or select a project, then enable **YouTube Data API v3**.
2. **OAuth consent screen** → User type **External**. Add the scope
   `https://www.googleapis.com/auth/youtube.upload`.
3. **Publishing status matters.** While the app sits in **Testing**, Google
   expires refresh tokens after **seven days** — a daily cron will work for a
   week and then start failing on token refresh. Move it to **In production**
   so the token is long-lived. Publishing an unverified app that uses a
   sensitive scope shows an "unverified app" interstitial you click through,
   and is capped at 100 users; for your own channel that is fine. Verification
   is only needed to distribute it to others.
4. **Credentials** → Create credentials → OAuth client ID → application type
   **Desktop app**. Copy the client ID and secret.

### Then run the helper

```bash
python scripts/youtube_auth.py --client-id XXX --client-secret YYY
```

It opens the consent screen, catches the redirect on a loopback port, and
prints the three values to set as repository secrets. Add `--no-browser` on a
headless box to print the URL instead, and `--port` to pin the loopback port.

Two failure modes it exists to avoid:

- Google returns a refresh token only when the request carries **both**
  `access_type=offline` and `prompt=consent`. Miss the second and you get a
  refresh token on the first authorisation and silently only an access token
  on every later one — so re-running to "fix" a problem hands you nothing
  usable. If it reports no refresh token, revoke the app at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and run it again.
- The copy-paste out-of-band flow (`urn:ietf:wg:oauth:2.0:oob`) was switched
  off by Google in 2022. Guides that tell you to paste a code from the browser
  no longer work; this uses the loopback redirect that replaced it.

The refresh token is long-lived but not permanent — it is revoked if you change
your Google password, revoke the app, or leave it unused for six months. When
uploads start failing on token refresh, re-run the helper.

## Running it on a schedule

`.github/workflows/faceless-content.yml` runs the pipeline daily. It installs
ffmpeg and espeak-ng, renders a video, and uploads it as a build artifact.
It only passes `--publish` when `PUBLISH_TARGETS` is set as a repository
variable — otherwise it is a render-only rehearsal, which is also what pull
requests get.

Add whichever keys you have as repository **secrets**, and set the repository
**variable** `PUBLISH_TARGETS` (e.g. `youtube,tiktok`) when you are ready to go
live.

Because a hosted runner gets a fresh filesystem, `output/state.json` does not
survive between runs there; the workflow restores it from the actions cache so
the topic cooldown keeps working.

## Known limits

- **Reddit blocks datacenter IPs.** It returns `403 Blocked` for cloud traffic,
  including GitHub-hosted runners, so in CI it contributes nothing. Wikimedia
  rate-limits anonymous callers per IP and returns `429` on some shared hosts
  (though not on GitHub runners, where it works unauthenticated); set
  `WIKIMEDIA_ACCESS_TOKEN` for the authenticated allowance. Both are skipped
  gracefully — absorbing this is the point of querying several sources.
- **Captions are estimated, not force-aligned.** Timing is proportional to text
  weight, which tracks a 40-second read closely but will drift on much longer
  narration. A forced aligner (e.g. WhisperX) would be the fix.
- **Instagram cannot be fed a local file.** The Graph API fetches the video
  itself, so `publish.public_base_url` must point at somewhere the rendered file
  is actually served from.
- **The template script writer is a floor, not a substitute.** With no summary
  available it produces generic copy. Set `ANTHROPIC_API_KEY` for real scripts.
- **Nothing checks the facts.** The model is instructed to prefer well
  established claims, but an unattended pipeline publishing about live trending
  topics carries real risk of being confidently wrong. Review the first several
  runs before leaving it alone.

## Tests

```bash
python -m pytest
```

129 tests. Everything is offline: network calls are never made, the Anthropic
client is faked, and ffmpeg command construction is asserted argument by
argument. Two integration tests do a real end-to-end render (gradient visuals +
espeak voice) and skip automatically if `ffmpeg` or `espeak-ng` is missing.
