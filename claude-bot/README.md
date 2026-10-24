# Claude Bot

A small terminal chatbot built on the Anthropic API (streaming, multi-turn history).

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your-key
python bot.py --system "You are a friendly coding tutor."
```

Chat commands: `/reset` clears history, `/quit` exits.
