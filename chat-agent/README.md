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
