# Chat Agent

A terminal agent you can talk to continuously. It streams replies, remembers the
whole conversation, and saves it to `history.json` so you can quit and pick up later.

```bash
cd chat-agent
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python chat_agent.py
```

Commands: `/reset`, `/undo`, `/system`, `/help`, `/quit`.

Config via env vars: `CHAT_AGENT_MODEL`, `CHAT_AGENT_SYSTEM` (personality),
`CHAT_AGENT_MAX_TOKENS`, `CHAT_AGENT_HISTORY`.

## Voice

```bash
pip install -r requirements-voice.txt   # needs a microphone; on Linux also: sudo apt install portaudio19-dev espeak
python chat_agent.py --voice
```

Speak when it says "listening...", and it replies out loud. Press Ctrl-C while
listening to type one message instead; say "goodbye" to quit. Speech-to-text uses
SpeechRecognition's free Google web recognizer, so audio is sent to Google; swap
`Voice.listen` for another recognizer if you want it fully local.

## Web version (talk in the browser)

```bash
pip install -r requirements-web.txt
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...      # optional, for a natural-sounding voice
python web_server.py              # open http://localhost:8000
```

Press the mic once for a continuous conversation: it listens, answers out loud
(starting as soon as the first sentence is ready), then listens again. Press it
again to stop. You can also type, mute replies, "Stop voice" to interrupt, or
start a "New chat". Conversations persist per browser in `history_web.json`.

- **Listening** uses the browser's speech recognition: Chrome, Edge or Safari
  (audio goes to the browser vendor's service). Use headphones, otherwise the mic can pick up the agent's own voice.
- **Natural voice:** with `OPENAI_API_KEY` set, replies use OpenAI text-to-speech
  (`CHAT_AGENT_TTS_VOICE`, default `nova`; `CHAT_AGENT_TTS_MODEL`). Without it, the
  page picks the best voice your browser has (Edge "Natural", macOS "Premium", Chrome "Google") and lets you change it.
- The server binds to `127.0.0.1` by default and has no login; don't expose it
  publicly (`HOST=0.0.0.0`) without adding authentication, since it spends your API credits.
