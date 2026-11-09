#!/usr/bin/env python3
"""A conversational agent you can talk to continuously in the terminal.

Keeps the full conversation history (persisted to disk, so you can quit and
resume later), streams replies as they are generated, and trims the oldest
turns if the history grows too large.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    pip install -r requirements.txt
    python chat_agent.py

Commands (type at the prompt):
    /reset   forget the conversation and start fresh
    /undo    drop your last message and the agent's reply
    /system  show the current system prompt
    /help    show this list
    /quit    exit (Ctrl-D / Ctrl-C also work)
"""
import json
import os
import sys
from pathlib import Path

import anthropic

MODEL = os.environ.get("CHAT_AGENT_MODEL", "claude-sonnet-5-5")
MAX_TOKENS = int(os.environ.get("CHAT_AGENT_MAX_TOKENS", "2048"))
HISTORY_FILE = Path(os.environ.get("CHAT_AGENT_HISTORY", Path(__file__).with_name("history.json")))
MAX_MESSAGES = 200  # keep the most recent N messages when sending to the API

SYSTEM_PROMPT = os.environ.get(
    "CHAT_AGENT_SYSTEM",
    "You are a friendly, thoughtful conversation partner in an ongoing, "
    "open-ended chat. Remember everything said earlier in the conversation and "
    "refer back to it naturally. Keep replies conversational and concise "
    "(a few sentences unless asked for more), ask a follow-up question when it "
    "helps the conversation continue, and be honest when you don't know something.",
)


def load_history() -> list[dict]:
    try:
        return json.loads(HISTORY_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_history(messages: list[dict]) -> None:
    HISTORY_FILE.write_text(json.dumps(messages, indent=2, ensure_ascii=False))


def window(messages: list[dict]) -> list[dict]:
    """Return the most recent messages, always starting on a user turn."""
    recent = messages[-MAX_MESSAGES:]
    while recent and recent[0]["role"] != "user":
        recent = recent[1:]
    return recent


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Set ANTHROPIC_API_KEY first (export ANTHROPIC_API_KEY=...).", file=sys.stderr)
        return 1

    client = anthropic.Anthropic()
    messages = load_history()
    if messages:
        print(f"(Resumed a conversation with {len(messages)} messages. /reset to start over.)")
    print("Chat started. Type /help for commands, /quit to exit.\n")

    while True:
        try:
            user = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            return 0
        if not user:
            continue

        if user.startswith("/"):
            cmd = user.lower()
            if cmd in ("/quit", "/exit"):
                print("Bye!")
                return 0
            if cmd == "/reset":
                messages = []
                save_history(messages)
                print("(Conversation cleared.)")
            elif cmd == "/undo":
                messages = messages[:-2] if len(messages) >= 2 else []
                save_history(messages)
                print("(Last exchange removed.)")
            elif cmd == "/system":
                print(SYSTEM_PROMPT)
            else:
                print(__doc__)
            continue

        messages.append({"role": "user", "content": user})
        reply = ""
        try:
            print("agent> ", end="", flush=True)
            with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=window(messages),
            ) as stream:
                for text in stream.text_stream:
                    reply += text
                    print(text, end="", flush=True)
            print("\n")
        except KeyboardInterrupt:
            print("\n(interrupted)\n")
        except anthropic.APIError as e:
            print(f"\n[API error: {e}]\n")
            messages.pop()  # let the user retry the same message
            continue

        if reply:
            messages.append({"role": "assistant", "content": reply})
        else:
            messages.pop()
        save_history(messages)


if __name__ == "__main__":
    sys.exit(main())
