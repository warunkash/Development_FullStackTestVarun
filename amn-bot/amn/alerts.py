"""FR-3 alerting: Telegram / generic webhook. Without credentials it only logs."""
import json
import os
import urllib.request


class Notifier:
    EVENTS = {"BOS", "INDUCEMENT", "SWEEP", "TRADE_EXECUTED", "DAILY_DD"}

    def __init__(self, sender=None):
        self.sent = []
        self.sender = sender or self._default_sender

    def __call__(self, kind, text):
        if kind not in self.EVENTS:
            return
        self.sent.append((kind, text))
        self.sender(f"[AMN] {kind}: {text}")

    @staticmethod
    def _default_sender(msg):
        tok, chat, hook = (os.getenv("TELEGRAM_TOKEN"), os.getenv("TELEGRAM_CHAT_ID"),
                           os.getenv("ALERT_WEBHOOK"))
        try:
            if tok and chat:
                data = json.dumps({"chat_id": chat, "text": msg}).encode()
                urllib.request.urlopen(urllib.request.Request(
                    f"https://api.telegram.org/bot{tok}/sendMessage", data,
                    {"Content-Type": "application/json"}), timeout=5)
            if hook:
                urllib.request.urlopen(urllib.request.Request(
                    hook, json.dumps({"text": msg}).encode(),
                    {"Content-Type": "application/json"}), timeout=5)
        except Exception:      # alerting must never break trading
            pass
        print(msg)

    def engine_hook(self, symbol, ts, old, new, note, details):
        kind = {"BOS": "BOS", "INDUCEMENT": "INDUCEMENT", "SWEEP": "SWEEP"}.get(note)
        if kind:
            self(kind, f"{symbol} {details}")
