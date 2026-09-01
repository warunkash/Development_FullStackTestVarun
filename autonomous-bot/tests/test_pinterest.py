"""Tests for the Pinterest v5 integration.

All HTTP is faked, so nothing here touches the network or needs credentials.
The point of these tests is that the request shape is right and - just as
important - that the safety gates actually stop a publish.
"""

from __future__ import annotations

import io
import json
import urllib.error

import pytest

from autobot.config import BotConfig, ConfigError
from autobot.pinterest import (
    PRODUCTION_BASE,
    SANDBOX_BASE,
    TOKEN_ENV,
    PinterestClient,
    PinterestConfig,
    PinterestError,
    pinterest_create_pin,
    pinterest_list_boards,
)
from autobot.runner import build_registry
from autobot.tools import ToolContext


class FakeResponse(io.BytesIO):
    """Minimal stand-in for the object urlopen returns."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


@pytest.fixture()
def capture(monkeypatch):
    """Capture outbound requests and script the responses."""
    sent: list[dict] = []
    scripted: list = []

    def fake_urlopen(request, timeout=None):
        sent.append(
            {
                "url": request.full_url,
                "method": request.get_method(),
                "headers": {k.lower(): v for k, v in request.headers.items()},
                "body": json.loads(request.data.decode()) if request.data else None,
                "timeout": timeout,
            }
        )
        if scripted:
            nxt = scripted.pop(0)
            if isinstance(nxt, Exception):
                raise nxt
            return FakeResponse(json.dumps(nxt).encode())
        return FakeResponse(b"{}")

    monkeypatch.setattr("autobot.pinterest.urllib.request.urlopen", fake_urlopen)
    return type("Capture", (), {"sent": sent, "script": scripted})()


def http_error(status: int, detail: str = "boom") -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        "https://api.pinterest.com/v5/pins", status, "err", {}, io.BytesIO(detail.encode())
    )


def live_client(**overrides) -> PinterestClient:
    """A client with dry-run OFF, for testing the real request path."""
    settings = {"access_token": "tok", "dry_run": False}
    settings.update(overrides)
    return PinterestClient(PinterestConfig(**settings))


class TestConfigResolution:
    def test_dry_run_defaults_on(self):
        # Publishing is irreversible; the safe default must be the quiet one.
        assert PinterestConfig().dry_run is True

    def test_reads_token_from_environment(self, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "secret-token")
        assert PinterestConfig.from_bot_config(BotConfig()).access_token == "secret-token"

    def test_sandbox_switches_base_url(self, monkeypatch):
        monkeypatch.delenv(TOKEN_ENV, raising=False)
        assert PinterestConfig.from_bot_config(BotConfig()).base_url == PRODUCTION_BASE
        sandboxed = BotConfig(pinterest={"sandbox": True})
        assert PinterestConfig.from_bot_config(sandboxed).base_url == SANDBOX_BASE

    def test_config_can_disable_dry_run(self, monkeypatch):
        monkeypatch.delenv("AUTOBOT_PINTEREST_DRY_RUN", raising=False)
        config = BotConfig(pinterest={"dry_run": False})
        assert PinterestConfig.from_bot_config(config).dry_run is False

    def test_env_can_force_dry_run_on_but_never_off(self, monkeypatch):
        # CI sets this to guarantee a scheduled run cannot publish.
        monkeypatch.setenv("AUTOBOT_PINTEREST_DRY_RUN", "true")
        config = BotConfig(pinterest={"dry_run": False})
        assert PinterestConfig.from_bot_config(config).dry_run is True


class TestSecretHandling:
    def test_repr_redacts_the_token(self):
        # A config object can end up in a log line or a traceback; the token
        # must not ride along with it.
        text = repr(PinterestConfig(access_token="super-secret-value"))
        assert "super-secret-value" not in text
        assert "***set***" in text

    def test_repr_marks_an_absent_token(self):
        assert "(unset)" in repr(PinterestConfig())

    def test_errors_never_echo_the_token(self, capture):
        capture.script.append(http_error(401, "unauthorized"))
        with pytest.raises(PinterestError) as excinfo:
            live_client(access_token="super-secret-value").list_boards()
        assert "super-secret-value" not in str(excinfo.value)


class TestConfigValidation:
    def test_rejects_unknown_pinterest_key(self):
        with pytest.raises(ConfigError, match="unknown key"):
            BotConfig.from_dict({"pinterest": {"dryrun": True}})

    def test_rejects_non_boolean_dry_run(self):
        with pytest.raises(ConfigError, match="must be true or false"):
            BotConfig.from_dict({"pinterest": {"dry_run": "no"}})

    def test_rejects_non_mapping_section(self):
        with pytest.raises(ConfigError, match="must be a mapping"):
            BotConfig.from_dict({"pinterest": ["dry_run"]})

    def test_accepts_a_valid_section(self):
        config = BotConfig.from_dict({"pinterest": {"dry_run": False, "max_pins_per_run": 2}})
        assert config.pinterest["max_pins_per_run"] == 2


class TestCreatePinRequest:
    def test_builds_the_documented_body(self, capture):
        capture.script.append({"id": "pin-1"})
        result = live_client().create_pin(
            board_id="board-9",
            image_url="https://cdn.example.com/a.png",
            title="Hello",
            description="World",
            link="https://example.com/post",
            alt_text="A picture",
        )

        request = capture.sent[0]
        assert request["method"] == "POST"
        assert request["url"] == "https://api.pinterest.com/v5/pins"
        assert request["headers"]["authorization"] == "Bearer tok"
        assert request["body"] == {
            "board_id": "board-9",
            "media_source": {"source_type": "image_url", "url": "https://cdn.example.com/a.png"},
            "title": "Hello",
            "description": "World",
            "link": "https://example.com/post",
            "alt_text": "A picture",
        }
        assert result["id"] == "pin-1"

    def test_omits_empty_optional_fields(self, capture):
        capture.script.append({"id": "pin-2"})
        live_client().create_pin(board_id="b", image_url="https://x.test/i.png")
        assert set(capture.sent[0]["body"]) == {"board_id", "media_source"}

    def test_trims_overlong_text(self, capture):
        capture.script.append({"id": "pin-3"})
        live_client().create_pin(
            board_id="b", image_url="https://x.test/i.png", title="T" * 500, description="D" * 2000
        )
        body = capture.sent[0]["body"]
        assert len(body["title"]) == 100
        assert len(body["description"]) == 800

    def test_list_boards_parses_items(self, capture):
        capture.script.append({"items": [{"id": "1", "name": "Recipes"}]})
        boards = live_client().list_boards()
        assert boards == [{"id": "1", "name": "Recipes"}]
        assert "page_size=25" in capture.sent[0]["url"]


class TestSafetyGates:
    def test_dry_run_sends_nothing(self, capture):
        client = PinterestClient(PinterestConfig(access_token="tok", dry_run=True))
        result = client.create_pin(board_id="b", image_url="https://x.test/i.png")

        assert capture.sent == []  # the whole point
        assert result["dry_run"] is True
        assert result["request"]["board_id"] == "b"

    def test_per_run_cap_is_enforced(self, capture):
        client = live_client(max_pins_per_run=2)
        capture.script.extend([{"id": "1"}, {"id": "2"}])
        client.create_pin(board_id="b", image_url="https://x.test/1.png")
        client.create_pin(board_id="b", image_url="https://x.test/2.png")

        with pytest.raises(PinterestError, match="per-run cap reached"):
            client.create_pin(board_id="b", image_url="https://x.test/3.png")
        assert len(capture.sent) == 2

    def test_dry_run_still_counts_against_the_cap(self, capture):
        client = PinterestClient(PinterestConfig(access_token="t", dry_run=True, max_pins_per_run=1))
        client.create_pin(board_id="b", image_url="https://x.test/1.png")
        with pytest.raises(PinterestError, match="per-run cap"):
            client.create_pin(board_id="b", image_url="https://x.test/2.png")

    def test_create_pin_is_registered_dangerous(self):
        assert pinterest_create_pin.tool.dangerous is True
        assert pinterest_list_boards.tool.dangerous is False

    def test_publishing_tool_is_hidden_unless_opted_in(self):
        # The default registry must not expose a tool that posts publicly.
        assert "pinterest_create_pin" not in build_registry(BotConfig())
        assert "pinterest_list_boards" in build_registry(BotConfig())
        assert "pinterest_create_pin" in build_registry(BotConfig(allow_dangerous_tools=True))


class TestTokenRequirementDetection:
    """Which enabled tasks can actually reach Pinterest.

    Regression cover: a `pinterest:` block with every pinterest task disabled
    used to be reported as a missing-token problem, which failed CI on a config
    that was in fact perfectly valid.
    """

    def _config(self, **raw):
        return BotConfig.from_dict({"pinterest": {"dry_run": True}, **raw})

    def test_disabled_pinterest_task_does_not_require_a_token(self):
        config = self._config(
            tasks=[
                {
                    "name": "pins",
                    "objective": "post",
                    "enabled": False,
                    "playbook": [{"tool": "pinterest_create_pin"}],
                },
                {
                    "name": "heartbeat",
                    "objective": "ping",
                    "playbook": [{"tool": "current_time"}],
                },
            ]
        )
        assert config.tasks_reaching("pinterest_") == []

    def test_enabled_playbook_using_pinterest_requires_a_token(self):
        config = self._config(
            tasks=[
                {
                    "name": "pins",
                    "objective": "post",
                    "playbook": [{"tool": "pinterest_list_boards"}],
                }
            ]
        )
        assert [t.name for t in config.tasks_reaching("pinterest_")] == ["pins"]

    def test_open_ended_task_counts_under_the_claude_policy(self):
        # No playbook means the model chooses; assume it can reach anything.
        config = self._config(
            policy="claude", tasks=[{"name": "free", "objective": "do things"}]
        )
        assert [t.name for t in config.tasks_reaching("pinterest_")] == ["free"]

    def test_open_ended_task_does_not_count_under_the_rule_policy(self):
        # The rule policy can only run a playbook, so with none it calls nothing.
        config = self._config(
            policy="rule", tasks=[{"name": "free", "objective": "do things"}]
        )
        assert config.tasks_reaching("pinterest_") == []


class TestDoctorExitCodes:
    """The doctor exit code is what CI keys off, so pin it down."""

    def _write(self, tmp_path, body: str) -> str:
        path = tmp_path / "autobot.yaml"
        path.write_text(body)
        return str(path)

    def test_passes_when_no_enabled_task_uses_pinterest(self, tmp_path, monkeypatch, capsys):
        from autobot.cli import EXIT_OK, main

        monkeypatch.delenv(TOKEN_ENV, raising=False)
        config = self._write(
            tmp_path,
            f"policy: rule\nworkspace: {tmp_path}\npinterest:\n  dry_run: true\n"
            "tasks:\n  - name: heartbeat\n    objective: ping\n"
            "    playbook:\n      - tool: current_time\n",
        )
        assert main(["-c", config, "-q", "doctor"]) == EXIT_OK
        assert "no enabled task uses Pinterest" in capsys.readouterr().out

    def test_fails_when_an_enabled_task_needs_the_missing_token(
        self, tmp_path, monkeypatch, capsys
    ):
        from autobot.cli import EXIT_CONFIG_ERROR, main

        monkeypatch.delenv(TOKEN_ENV, raising=False)
        config = self._write(
            tmp_path,
            f"policy: rule\nworkspace: {tmp_path}\npinterest:\n  dry_run: true\n"
            "tasks:\n  - name: boards\n    objective: read\n"
            "    playbook:\n      - tool: pinterest_list_boards\n",
        )
        assert main(["-c", config, "-q", "doctor"]) == EXIT_CONFIG_ERROR
        assert "can call Pinterest" in capsys.readouterr().out

    def test_flags_live_mode_without_the_dangerous_gate(self, tmp_path, monkeypatch, capsys):
        from autobot.cli import EXIT_CONFIG_ERROR, main

        monkeypatch.setenv(TOKEN_ENV, "tok")
        monkeypatch.delenv("AUTOBOT_PINTEREST_DRY_RUN", raising=False)
        config = self._write(
            tmp_path,
            f"policy: rule\nworkspace: {tmp_path}\npinterest:\n  dry_run: false\n"
            "tasks:\n  - name: heartbeat\n    objective: ping\n"
            "    playbook:\n      - tool: current_time\n",
        )
        assert main(["-c", config, "-q", "doctor"]) == EXIT_CONFIG_ERROR
        assert "cannot post either way" in capsys.readouterr().out


class TestShippedConfigPassesDoctor:
    def test_repo_config_is_clean_without_any_credentials(self, monkeypatch, capsys):
        """The committed autobot.yaml must pass doctor in a bare CI checkout.

        This is the exact check the workflow runs; it failed once already.
        """
        from pathlib import Path

        from autobot.cli import EXIT_OK, main

        monkeypatch.delenv(TOKEN_ENV, raising=False)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        shipped = Path(__file__).resolve().parent.parent / "autobot.yaml"
        assert main(["-c", str(shipped), "-q", "doctor"]) == EXIT_OK


class TestErrorHandling:
    def test_missing_token_names_the_variable_and_scopes(self, capture):
        client = PinterestClient(PinterestConfig(access_token="", dry_run=False))
        with pytest.raises(PinterestError, match=TOKEN_ENV):
            client.list_boards()
        assert capture.sent == []

    @pytest.mark.parametrize(
        "status,expected",
        [
            (401, "expired or revoked"),
            (403, "scope"),
            (404, "does not exist"),
            (429, "rate limited"),
        ],
    )
    def test_http_errors_are_explained(self, capture, status, expected):
        capture.script.append(http_error(status))
        with pytest.raises(PinterestError, match=expected):
            live_client().create_pin(board_id="b", image_url="https://x.test/i.png")

    def test_network_failure_is_reported(self, capture):
        capture.script.append(urllib.error.URLError("dns went away"))
        with pytest.raises(PinterestError, match="could not reach"):
            live_client().list_boards()

    def test_non_json_response_is_reported(self, monkeypatch):
        monkeypatch.setattr(
            "autobot.pinterest.urllib.request.urlopen",
            lambda request, timeout=None: FakeResponse(b"<html>nope</html>"),
        )
        with pytest.raises(PinterestError, match="non-JSON"):
            live_client().list_boards()


class TestTools:
    def _ctx(self, **pinterest) -> ToolContext:
        return ToolContext(workspace=".", config=BotConfig(pinterest=pinterest))

    def test_rejects_non_https_image(self, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        with pytest.raises(PinterestError, match="must be a public https URL"):
            pinterest_create_pin.tool.call(
                {"board_id": "b", "image_url": "http://x.test/i.png"}, self._ctx()
            )

    def test_rejects_local_file_path(self, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        with pytest.raises(PinterestError, match="cannot read local files"):
            pinterest_create_pin.tool.call(
                {"board_id": "b", "image_url": "/tmp/local.png"}, self._ctx()
            )

    def test_rejects_blank_board(self, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        with pytest.raises(PinterestError, match="board_id is required"):
            pinterest_create_pin.tool.call(
                {"board_id": "  ", "image_url": "https://x.test/i.png"}, self._ctx()
            )

    def test_dry_run_message_is_unmistakable(self, capture, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        out = pinterest_create_pin.tool.call(
            {"board_id": "b", "image_url": "https://x.test/i.png"}, self._ctx(dry_run=True)
        )
        assert out.startswith("DRY RUN")
        assert capture.sent == []

    def test_real_post_reports_the_pin_id(self, capture, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        monkeypatch.delenv("AUTOBOT_PINTEREST_DRY_RUN", raising=False)
        capture.script.append({"id": "pin-42"})
        out = pinterest_create_pin.tool.call(
            {"board_id": "b", "image_url": "https://x.test/i.png"}, self._ctx(dry_run=False)
        )
        assert "pin-42" in out

    def test_client_is_reused_across_a_run(self, capture, monkeypatch):
        # One client per run is what makes the per-run cap meaningful.
        monkeypatch.setenv(TOKEN_ENV, "tok")
        ctx = self._ctx(dry_run=True, max_pins_per_run=1)
        pinterest_create_pin.tool.call(
            {"board_id": "b", "image_url": "https://x.test/1.png"}, ctx
        )
        with pytest.raises(PinterestError, match="per-run cap"):
            pinterest_create_pin.tool.call(
                {"board_id": "b", "image_url": "https://x.test/2.png"}, ctx
            )

    def test_list_boards_formats_output(self, capture, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        capture.script.append({"items": [{"id": "1", "name": "Food"}, {"id": "2", "name": "Art"}]})
        out = pinterest_list_boards.tool.call({}, self._ctx())
        assert "1  Food" in out and "2  Art" in out

    def test_list_boards_handles_empty_account(self, capture, monkeypatch):
        monkeypatch.setenv(TOKEN_ENV, "tok")
        capture.script.append({"items": []})
        assert "No boards found" in pinterest_list_boards.tool.call({}, self._ctx())
