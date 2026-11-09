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
