#!/usr/bin/env python3
"""One-time helper: obtain a YouTube refresh token for the publish target.

Run this once on a machine with a browser. It prints the three values the
pipeline needs as secrets: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and
YOUTUBE_REFRESH_TOKEN.

    python scripts/youtube_auth.py --client-id XXX --client-secret YYY

Two things routinely go wrong and both are handled here:

* Google only returns a refresh token when the request carries
  ``access_type=offline`` AND ``prompt=consent``. Without the second one you
  get a refresh token on the very first authorisation and silently only an
  access token on every later one - so a re-run to "fix" things gives you
  nothing usable.
* The out-of-band copy-paste flow (``urn:ietf:wg:oauth:2.0:oob``) was turned
  off by Google in 2022. This uses the loopback redirect instead, which is
  what Desktop-app clients are expected to use.
"""

from __future__ import annotations

import argparse
import http.server
import secrets
import socket
import sys
import threading
import urllib.parse
import webbrowser

import requests

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/youtube.upload"

_SUCCESS_PAGE = b"""<!doctype html><meta charset="utf-8">
<title>Authorised</title>
<body style="font-family:system-ui;padding:3rem;max-width:32rem">
<h1>Authorised</h1><p>Return to your terminal; the refresh token is printed there.</p>
</body>"""

_FAILURE_PAGE = b"""<!doctype html><meta charset="utf-8">
<title>Authorisation failed</title>
<body style="font-family:system-ui;padding:3rem;max-width:32rem">
<h1>Authorisation failed</h1><p>See the terminal for details.</p>
</body>"""


def build_auth_url(client_id: str, redirect_uri: str, state: str) -> str:
    """The consent URL. ``access_type`` and ``prompt`` are what yield a refresh token."""
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return f"{AUTH_ENDPOINT}?{query}"


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    """Captures the single redirect Google makes back to the loopback address."""

    result: dict = {}
    expected_state: str = ""

    def do_GET(self) -> None:  # noqa: N802 - name fixed by BaseHTTPRequestHandler
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        state = (params.get("state") or [""])[0]

        if state != self.expected_state:
            # Wrong or missing state: refuse it rather than exchanging a code
            # that did not come from the request we just made.
            _CallbackHandler.result = {"error": "state mismatch"}
            self.send_response(400)
            self.end_headers()
            self.wfile.write(_FAILURE_PAGE)
            return

        if "error" in params:
            _CallbackHandler.result = {"error": params["error"][0]}
            self.send_response(400)
            self.end_headers()
            self.wfile.write(_FAILURE_PAGE)
            return

        code = (params.get("code") or [""])[0]
        if not code:
            _CallbackHandler.result = {"error": "no code returned"}
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(_FAILURE_PAGE)
            return

        _CallbackHandler.result = {"code": code}
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(_SUCCESS_PAGE)

    def log_message(self, *args) -> None:
        """Silence the default stderr access log."""


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def exchange_code(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    """Trade the one-time authorisation code for tokens."""
    response = requests.post(
        TOKEN_ENDPOINT,
        timeout=30,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    if response.status_code >= 400:
        raise SystemExit(f"token exchange failed ({response.status_code}): {response.text[:400]}")
    return response.json()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--client-id", required=True, help="OAuth client ID (Desktop app)")
    parser.add_argument("--client-secret", required=True, help="OAuth client secret")
    parser.add_argument(
        "--port", type=int, default=0, help="loopback port (default: pick a free one)"
    )
    parser.add_argument(
        "--no-browser", action="store_true", help="print the URL instead of opening a browser"
    )
    args = parser.parse_args(argv)

    port = args.port or free_port()
    redirect_uri = f"http://localhost:{port}"
    state = secrets.token_urlsafe(24)

    _CallbackHandler.expected_state = state
    _CallbackHandler.result = {}
    server = http.server.HTTPServer(("127.0.0.1", port), _CallbackHandler)

    auth_url = build_auth_url(args.client_id, redirect_uri, state)
    print(f"Listening on {redirect_uri}\n")
    print("Open this URL and grant access to the channel you want to upload to:\n")
    print(f"  {auth_url}\n")
    if not args.no_browser:
        threading.Thread(target=lambda: webbrowser.open(auth_url), daemon=True).start()

    # Exactly one request is expected: Google's redirect back to us.
    server.handle_request()
    server.server_close()

    result = _CallbackHandler.result
    if "error" in result:
        print(f"authorisation failed: {result['error']}", file=sys.stderr)
        return 1

    tokens = exchange_code(result["code"], args.client_id, args.client_secret, redirect_uri)
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print(
            "no refresh_token in the response. This happens when the account has already\n"
            "granted this client and Google returned only an access token. Revoke it at\n"
            "https://myaccount.google.com/permissions and run this again.",
            file=sys.stderr,
        )
        return 1

    print("\nSet these three as repository secrets:\n")
    print(f"  YOUTUBE_CLIENT_ID={args.client_id}")
    print(f"  YOUTUBE_CLIENT_SECRET={args.client_secret}")
    print(f"  YOUTUBE_REFRESH_TOKEN={refresh_token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
