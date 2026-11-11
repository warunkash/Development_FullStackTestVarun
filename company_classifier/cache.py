"""
Company knowledge cache — check here first before hitting classifiers.
Stores known company classifications for fast lookup and result persistence.
"""

import json
import os
import re
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_CACHE_PATH = Path(__file__).parent / "company_cache.json"
VALID_LABELS = {"Product Company", "Recruitment Company", "Service Company", "Unknown"}


def _normalize(name: str) -> str:
    """Lowercase and strip punctuation for fuzzy key matching."""
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


class CompanyCache:
    def __init__(self, path: Optional[str] = None):
        self._path = Path(path) if path else DEFAULT_CACHE_PATH
        self._data: dict[str, str] = {}
        self._dirty = False
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                with open(self._path, "r") as f:
                    raw = json.load(f)
                self._data = {_normalize(k): v for k, v in raw.items()}
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"Could not load cache from {self._path}: {e}")
                self._data = {}

    def lookup(self, company_name: str) -> Optional[str]:
        key = _normalize(company_name)
        result = self._data.get(key)
        if result:
            return result
        # Partial match: check if any cached key is contained within the name
        for cached_key, label in self._data.items():
            if cached_key in key or key in cached_key:
                if len(cached_key) >= 4:  # avoid spurious short-string matches
                    return label
        return None

    def store(self, company_name: str, label: str) -> None:
        if label not in VALID_LABELS:
            raise ValueError(f"Invalid label '{label}'. Must be one of {VALID_LABELS}")
        key = _normalize(company_name)
        if self._data.get(key) != label:
            self._data[key] = label
            self._dirty = True

    def save(self) -> None:
        if not self._dirty:
            return
        try:
            with open(self._path, "w") as f:
                json.dump(self._data, f, indent=2, sort_keys=True)
            self._dirty = False
            logger.info(f"Cache saved to {self._path} ({len(self._data)} entries)")
        except OSError as e:
            logger.error(f"Could not save cache: {e}")

    def __len__(self) -> int:
        return len(self._data)

    def __contains__(self, company_name: str) -> bool:
        return self.lookup(company_name) is not None

    def __del__(self):
        if self._dirty:
            self.save()
