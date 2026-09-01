"""Pinterest API v5 client and agent tools.

The bot runs standalone (a daemon, or a GitHub Actions job), so it talks to
Pinterest over the REST API directly rather than through any desktop
integration:

* Base URL: ``https://api.pinterest.com/v5`` (sandbox: ``api-sandbox``)
* Create a pin: ``POST /pins``
* List boards: ``GET /boards``

Auth is a bearer token read from ``PINTEREST_ACCESS_TOKEN``. Creating a pin
publishes to a public account and cannot be undone by re-running anything, so
``pinterest_create_pin`` is registered as a dangerous tool *and* is additionally
gated behind a dry-run switch that defaults to on.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from .tools import ToolContext, ToolError, tool

logger = logging.getLogger("autobot.pinterest")

PRODUCTION_BASE = "https://api.pinterest.com/v5"
SANDBOX_BASE = "https://api-sandbox.pinterest.com/v5"

TOKEN_ENV = "PINTEREST_ACCESS_TOKEN"

#: Pinterest rejects overly long text; trim rather than have the API 400.
MAX_TITLE = 100
MAX_DESCRIPTION = 800


class PinterestError(ToolError):
    """A Pinterest API call failed in a way worth reporting to the agent."""


@dataclass
class PinterestConfig:
    """Everything the client needs, resolved from config plus environment."""

    access_token: str = ""
    base_url: str = PRODUCTION_BASE
    #: When true, requests are built and logged but never sent. Default on.
    dry_run: bool = True
    #: Hard ceiling on pins created per run, regardless of what the policy asks.
    max_pins_per_run: int = 5
    timeout_s: float = 30.0

    def __repr__(self) -> str:
        """Redact the token, so logging the config can never leak a credential."""
        shown = "***set***" if self.access_token else "(unset)"
        return (
            f"PinterestConfig(access_token={shown}, base_url={self.base_url!r}, "
            f"dry_run={self.dry_run}, max_pins_per_run={self.max_pins_per_run}, "
            f"timeout_s={self.timeout_s})"
        )

    @classmethod
    def from_bot_config(cls, config: Any) -> "PinterestConfig":
        """Read the ``pinterest`` section off a BotConfig, then the environment."""
        section = dict(getattr(config, "pinterest", None) or {})
        sandbox = bool(section.get("sandbox", False))
        resolved = cls(
            access_token=os.environ.get(TOKEN_ENV, ""),
            base_url=section.get("base_url") or (SANDBOX_BASE if sandbox else PRODUCTION_BASE),
            dry_run=bool(section.get("dry_run", True)),
            max_pins_per_run=int(section.get("max_pins_per_run", 5)),
            timeout_s=float(section.get("timeout_s", 30.0)),
        )
        # An explicit env override exists so CI can force dry-run on regardless
        # of what a task file says. It can only turn the safety on, never off.
        if os.environ.get("AUTOBOT_PINTEREST_DRY_RUN", "").strip().lower() in {"1", "true", "yes"}:
            resolved.dry_run = True
        return resolved


@dataclass
class PinterestClient:
    """A very small Pinterest v5 client built on the standard library."""

    config: PinterestConfig
    #: Pins actually created by this client instance, for the per-run cap.
    pins_created: int = field(default=0)

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        if not self.config.access_token:
            raise PinterestError(
                f"no Pinterest credentials: set {TOKEN_ENV} to an OAuth access token "
                "with the pins:write and boards:read scopes"
            )
        url = f"{self.config.base_url.rstrip('/')}/{path.lstrip('/')}"
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            url,
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.config.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "autobot/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_s) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise PinterestError(self._explain(exc.code, detail)) from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise PinterestError(f"could not reach the Pinterest API: {exc}") from exc

        if not raw.strip():
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise PinterestError(f"Pinterest returned a non-JSON response: {raw[:200]}") from exc

    @staticmethod
    def _explain(status: int, detail: str) -> str:
        """Turn an HTTP status into something the agent can act on."""
        hints = {
            401: "the access token is missing, expired or revoked - re-authorise the app",
            403: "the token lacks the required scope (pins:write / boards:read), "
            "or the account is not permitted to post",
            404: "the board or pin does not exist, or is not visible to this account",
            429: "rate limited by Pinterest - slow down and retry later",
        }
        hint = hints.get(status, "")
        suffix = f" ({hint})" if hint else ""
        return f"Pinterest API returned HTTP {status}{suffix}: {detail}"

    def list_boards(self, page_size: int = 25) -> list[dict]:
        """Return the account's boards (id and name)."""
        query = urllib.parse.urlencode({"page_size": max(1, min(page_size, 250))})
        payload = self._request("GET", f"/boards?{query}")
        return list(payload.get("items", []))

    def create_pin(
        self,
        board_id: str,
        image_url: str,
        title: str = "",
        description: str = "",
        link: str = "",
        alt_text: str = "",
    ) -> dict:
        """Create an image pin. Honours dry-run and the per-run cap."""
        if self.pins_created >= self.config.max_pins_per_run:
            raise PinterestError(
                f"per-run cap reached: {self.config.max_pins_per_run} pin(s) already created. "
                "Raise pinterest.max_pins_per_run if this is intended."
            )

        body: dict[str, Any] = {
            "board_id": board_id,
            "media_source": {"source_type": "image_url", "url": image_url},
        }
        if title:
            body["title"] = title[:MAX_TITLE]
        if description:
            body["description"] = description[:MAX_DESCRIPTION]
        if link:
            body["link"] = link
        if alt_text:
            body["alt_text"] = alt_text[:MAX_DESCRIPTION]

        if self.config.dry_run:
            # Everything is validated and logged, but nothing is published.
            logger.info("[dry-run] would POST /pins: %s", json.dumps(body, sort_keys=True))
            self.pins_created += 1
            return {"dry_run": True, "request": body}

        result = self._request("POST", "/pins", body)
        self.pins_created += 1
        return result


def _client(ctx: ToolContext) -> PinterestClient:
    """One client per run, cached on the tool context's scratch space."""
    existing = ctx.scratch.get("_pinterest_client")
    if isinstance(existing, PinterestClient):
        return existing
    client = PinterestClient(PinterestConfig.from_bot_config(ctx.config))
    ctx.scratch["_pinterest_client"] = client
    return client


@tool
def pinterest_list_boards(ctx: ToolContext, page_size: int = 25) -> str:
    """List the Pinterest boards this account can post to.

    Call this before creating a pin to find the board_id to post to.

    Args:
        page_size: How many boards to return (1-250).
    """
    boards = _client(ctx).list_boards(page_size=page_size)
    if not boards:
        return "No boards found for this account."
    lines = [f"{b.get('id', '?')}  {b.get('name', '(unnamed)')}" for b in boards]
    return "\n".join(lines)


@tool(dangerous=True)
def pinterest_create_pin(
    ctx: ToolContext,
    board_id: str,
    image_url: str,
    title: str = "",
    description: str = "",
    link: str = "",
    alt_text: str = "",
) -> str:
    """Publish an image pin to a Pinterest board.

    This posts publicly and cannot be undone by the bot, so it is a dangerous
    tool and additionally respects the pinterest.dry_run setting.

    Args:
        board_id: The board to pin to, from pinterest_list_boards.
        image_url: Publicly reachable https URL of the image to pin.
        title: Pin title, trimmed to 100 characters.
        description: Pin description, trimmed to 800 characters.
        link: Destination URL the pin should link to.
        alt_text: Accessibility description of the image.
    """
    parsed = urllib.parse.urlparse(image_url)
    if parsed.scheme != "https":
        raise PinterestError(
            f"image_url must be a public https URL, got {image_url!r}; "
            "Pinterest fetches the image itself and cannot read local files"
        )
    if not board_id.strip():
        raise PinterestError("board_id is required; call pinterest_list_boards first")

    client = _client(ctx)
    result = client.create_pin(
        board_id=board_id,
        image_url=image_url,
        title=title,
        description=description,
        link=link,
        alt_text=alt_text,
    )
    if result.get("dry_run"):
        return (
            "DRY RUN - nothing was published. Would create a pin on board "
            f"{board_id} from {image_url}. Set pinterest.dry_run: false to post for real."
        )
    return f"Created pin {result.get('id', '(no id returned)')} on board {board_id}."


@dataclass
class QueueEntry:
    """One pin waiting to be published."""

    board_id: str
    image_url: str
    title: str = ""
    description: str = ""
    link: str = ""
    alt_text: str = ""
    #: Stable de-duplication key. Falls back to the image URL.
    id: str = ""

    @property
    def key(self) -> str:
        return self.id or self.image_url

    @classmethod
    def from_dict(cls, raw: dict, line_no: int) -> "QueueEntry":
        if not isinstance(raw, dict):
            raise PinterestError(f"queue line {line_no}: expected an object, got {type(raw).__name__}")
        unknown = set(raw) - {f.name for f in cls.__dataclass_fields__.values()}
        if unknown:
            raise PinterestError(
                f"queue line {line_no}: unknown field(s) {', '.join(sorted(unknown))}"
            )
        for required in ("board_id", "image_url"):
            if not str(raw.get(required, "")).strip():
                raise PinterestError(f"queue line {line_no}: '{required}' is required")
        return cls(**{k: str(v) for k, v in raw.items()})


def _read_queue(path) -> list[QueueEntry]:
    """Parse a JSONL queue file, reporting the offending line on bad input."""
    if not path.is_file():
        return []
    entries: list[QueueEntry] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as exc:
            raise PinterestError(f"queue line {line_no}: invalid JSON: {exc}") from exc
        entries.append(QueueEntry.from_dict(raw, line_no))
    return entries


def _read_posted(path) -> set[str]:
    """The de-duplication keys of everything already published."""
    if not path.is_file():
        return set()
    done: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            done.add(str(json.loads(line).get("key", "")))
        except (json.JSONDecodeError, AttributeError):
            # A corrupt ledger line must not cause a re-post, so fail loudly.
            raise PinterestError(
                f"{path} contains a malformed line; refusing to run in case it "
                "hides an already-published pin"
            ) from None
    return done - {""}


@tool(dangerous=True)
def pinterest_post_queue(
    ctx: ToolContext,
    queue_path: str = "pins/queue.jsonl",
    posted_path: str = "runs/posted.jsonl",
    limit: int = 0,
) -> str:
    """Publish every not-yet-posted pin from a JSONL queue.

    Each queue line is an object with board_id and image_url, plus optional
    title, description, link, alt_text and id. Published pins are recorded in a
    ledger so re-running never posts the same entry twice - which is what makes
    this safe to put on a schedule.

    Args:
        queue_path: JSONL file of pins to publish, relative to the workspace.
        posted_path: Ledger of already-published pins, relative to the workspace.
        limit: Stop after this many pins (0 means use the configured per-run cap).
    """
    from .builtins import _resolve

    queue_file = _resolve(ctx, queue_path)
    ledger_file = _resolve(ctx, posted_path)

    entries = _read_queue(queue_file)
    if not entries:
        return f"Queue {queue_path} is empty or missing; nothing to post."

    already = _read_posted(ledger_file)
    pending = [e for e in entries if e.key not in already]
    if not pending:
        return f"All {len(entries)} queued pin(s) have already been posted; nothing to do."

    client = _client(ctx)
    budget = limit if limit > 0 else client.config.max_pins_per_run
    ledger_file.parent.mkdir(parents=True, exist_ok=True)

    posted, failures = 0, []
    for entry in pending:
        if posted >= budget:
            break
        try:
            result = client.create_pin(
                board_id=entry.board_id,
                image_url=entry.image_url,
                title=entry.title,
                description=entry.description,
                link=entry.link,
                alt_text=entry.alt_text,
            )
        except PinterestError as exc:
            failures.append(f"{entry.key}: {exc}")
            break  # stop on the first failure rather than hammering the API
        posted += 1
        # Record immediately: a crash after this point must not re-post.
        with ledger_file.open("a", encoding="utf-8") as handle:
            handle.write(
                json.dumps(
                    {
                        "key": entry.key,
                        "pin_id": result.get("id", ""),
                        "board_id": entry.board_id,
                        "dry_run": bool(result.get("dry_run")),
                    },
                    sort_keys=True,
                )
                + "\n"
            )

    mode = "DRY RUN - nothing published" if client.config.dry_run else "published"
    remaining = len(pending) - posted
    report = f"{mode}: {posted} pin(s), {remaining} still queued, {len(already)} previously done."
    if failures:
        report += " Stopped early: " + "; ".join(failures)
    return report


PINTEREST_TOOLS = [pinterest_list_boards, pinterest_create_pin, pinterest_post_queue]
