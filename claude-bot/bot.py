"""Simple Claude-powered chatbot for the terminal.

Usage:
    export ANTHROPIC_API_KEY=...
    python bot.py [--system "You are a pirate."] [--model claude-sonnet-5-5]

Commands inside the chat: /reset clears history, /quit exits.
"""
import argparse
import sys

import anthropic

DEFAULT_MODEL = "claude-sonnet-5-5"
DEFAULT_SYSTEM = "You are a helpful, concise assistant."


def chat_loop(client: anthropic.Anthropic, model: str, system: str) -> None:
    history: list[dict] = []
    print(f"Claude bot ({model}). Type /reset to clear, /quit to exit.")
    while True:
        try:
            user_input = input("\nyou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not user_input:
            continue
        if user_input == "/quit":
            return
        if user_input == "/reset":
            history.clear()
            print("History cleared.")
            continue

        history.append({"role": "user", "content": user_input})
        print("bot> ", end="", flush=True)
        try:
            with client.messages.stream(
                model=model, max_tokens=2048, system=system, messages=history
            ) as stream:
                for text in stream.text_stream:
                    print(text, end="", flush=True)
                reply = stream.get_final_message().content[0].text
            print()
        except anthropic.APIError as exc:
            history.pop()  # drop the failed turn so history stays valid
            print(f"\n[error] {exc}", file=sys.stderr)
            continue
        history.append({"role": "assistant", "content": reply})


def main() -> None:
    parser = argparse.ArgumentParser(description="Claude-powered chatbot")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--system", default=DEFAULT_SYSTEM)
    args = parser.parse_args()
    chat_loop(anthropic.Anthropic(), args.model, args.system)


if __name__ == "__main__":
    main()
