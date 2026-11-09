#!/usr/bin/env python3
"""A conversational agent you can talk to continuously in the terminal.

Keeps the full conversation history (persisted to disk, so you can quit and
resume later), streams replies as they are generated, and trims the oldest
turns if the history grows too large.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    pip install -r requirements.txt
    python chat_agent.py            # type to chat
    python chat_agent.py --voice    # speak to it, hear it reply

Voice mode needs the optional packages in requirements-voice.txt (microphone
input via SpeechRecognition + PyAudio, spoken replies via pyttsx3). In voice
mode you can still type: press Ctrl-C while it is listening to switch to
typing for one message. Say "quit" or "goodbye" to exit.

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


class Voice:
    """Microphone input and spoken output. Imports are lazy so text mode needs no extras."""

    def __init__(self) -> None:
        try:
            import pyttsx3
            import speech_recognition as sr
        except ImportError:
            sys.exit("Voice mode needs: pip install -r requirements-voice.txt")
        self.sr = sr
        self.rec = sr.Recognizer()
        self.mic = sr.Microphone()
        self.tts = pyttsx3.init()
        with self.mic as source:
            print("(Calibrating for background noise...)")
            self.rec.adjust_for_ambient_noise(source, duration=1)

    def listen(self) -> str:
        """Block until the user says something; return the transcript ('' if unclear)."""
        with self.mic as source:
            print("listening...", end="\r", flush=True)
            audio = self.rec.listen(source, phrase_time_limit=30)
        try:
            return self.rec.recognize_google(audio)
        except self.sr.UnknownValueError:
            return ""
        except self.sr.RequestError as e:
            print(f"[speech recognition unavailable: {e}]")
            return ""

    def speak(self, text: str) -> None:
        self.tts.say(text)
        self.tts.runAndWait()


def main() -> int:
    voice = Voice() if "--voice" in sys.argv[1:] else None
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
            if voice:
                try:
                    user = voice.listen()
                except KeyboardInterrupt:
                    user = input("you (typed)> ").strip()
                else:
                    if user:
                        print(f"you> {user}")
                if user.lower().strip(".!? ") in ("quit", "goodbye", "exit"):
                    print("Bye!")
                    return 0
            else:
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
            if voice and reply:
                voice.speak(reply)
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
