"""SQLite persistence for open positions and engine setups (NFR fault recovery)."""
import json
import sqlite3
from dataclasses import asdict

from .execution import Position


class Store:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path)
        self.db.execute("CREATE TABLE IF NOT EXISTS positions (symbol TEXT PRIMARY KEY, body TEXT)")
        self.db.execute("CREATE TABLE IF NOT EXISTS setups (symbol TEXT PRIMARY KEY, body TEXT)")
        self.db.commit()

    def save_position(self, pos: Position):
        self.db.execute("REPLACE INTO positions VALUES (?,?)", (pos.symbol, json.dumps(asdict(pos))))
        self.db.commit()

    def delete_position(self, symbol):
        self.db.execute("DELETE FROM positions WHERE symbol=?", (symbol,))
        self.db.commit()

    def save_setup(self, symbol, setup):
        if setup is None:
            self.db.execute("DELETE FROM setups WHERE symbol=?", (symbol,))
        else:
            self.db.execute("REPLACE INTO setups VALUES (?,?)", (symbol, json.dumps(asdict(setup))))
        self.db.commit()

    def load_positions(self):
        return {s: Position(**json.loads(b)) for s, b in self.db.execute("SELECT * FROM positions")}

    def load_setups(self):
        from .engine import Setup
        return {s: Setup(**json.loads(b)) for s, b in self.db.execute("SELECT * FROM setups")}
