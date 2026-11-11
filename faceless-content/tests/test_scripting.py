"""Tests for script generation and the Anthropic writer's request/response handling."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from faceless_content.config import ScriptConfig
from faceless_content.errors import ScriptError
from faceless_content.scripting import (
    AnthropicScriptWriter,
    TemplateScriptWriter,
    VideoScript,
    get_writer,
    word_budget,
    write_script,
)

PAYLOAD = {
    "title": "Why the ocean is salty",
    "hook": "The ocean did not start out salty.",
    "beats": ["Rain dissolves rock.", "Rivers carry the salt to the sea.", "Water leaves; salt stays."],
    "cta": "Follow for more.",
    "hashtags": ["#Science", "ocean!", ""],
    "visual_queries": ["rain on rock", "river mouth", "evaporating sea"],
}


class FakeMessages:
    """Stands in for ``client.messages``, capturing the request it was given."""

    def __init__(self, text: str, stop_reason: str = "end_turn"):
        self._text = text
        self._stop_reason = stop_reason
        self.request: dict = {}

    def create(self, **kwargs):
        self.request = kwargs
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=self._text)],
            stop_reason=self._stop_reason,
            stop_details=SimpleNamespace(category="cyber", explanation=""),
        )


def fake_client(text: str, stop_reason: str = "end_turn"):
    messages = FakeMessages(text, stop_reason)
    return SimpleNamespace(messages=messages), messages


def test_narration_joins_hook_beats_and_cta_in_order():
    script = VideoScript(
        topic="t", title="t", hook="Hook.", beats=["One.", "Two."], cta="Follow."
    )
    assert script.narration() == "Hook. One. Two. Follow."
    assert script.word_count() == 4


def test_narration_omits_an_empty_cta():
    script = VideoScript(topic="t", title="t", hook="Hook.", beats=["One."], cta="")
    assert script.narration() == "Hook. One."


def test_estimated_seconds_tracks_the_word_rate():
    script = VideoScript(topic="t", title="t", hook="a b c d e f", beats=[])
    assert script.estimated_seconds(2.0) == pytest.approx(3.0)


def test_word_budget_scales_with_target_duration():
    assert word_budget(ScriptConfig(target_seconds=60, words_per_second=2.5)) == 150
    # Never returns a budget too small to make a video from.
    assert word_budget(ScriptConfig(target_seconds=1, words_per_second=2.5)) == 30


def test_anthropic_writer_parses_a_structured_response():
    client, messages = fake_client(json.dumps(PAYLOAD))
    script = AnthropicScriptWriter(client=client).write("Ocean", "", ScriptConfig())

    assert script.hook == "The ocean did not start out salty."
    assert len(script.beats) == 3
    assert script.writer == "anthropic"
    # Hashtags are normalised to bare alphanumerics and empties dropped.
    assert script.hashtags == ["science", "ocean"]


def test_anthropic_writer_sends_the_documented_request_shape():
    client, messages = fake_client(json.dumps(PAYLOAD))
    cfg = ScriptConfig(model="claude-opus-5", effort="medium", max_beats=4)
    AnthropicScriptWriter(client=client).write("Ocean", "context here", cfg)

    request = messages.request
    assert request["model"] == "claude-opus-5"
    assert request["thinking"] == {"type": "adaptive"}
    assert request["output_config"]["effort"] == "medium"
    assert request["output_config"]["format"]["type"] == "json_schema"
    assert request["output_config"]["format"]["schema"]["additionalProperties"] is False
    assert "context here" in request["messages"][0]["content"]
    assert request["messages"][0]["role"] == "user"


def test_anthropic_writer_truncates_beats_to_the_configured_maximum():
    payload = dict(PAYLOAD, beats=[f"Beat {i}." for i in range(10)])
    client, _ = fake_client(json.dumps(payload))
    script = AnthropicScriptWriter(client=client).write("Ocean", "", ScriptConfig(max_beats=3))
    assert len(script.beats) == 3


def test_anthropic_writer_rejects_invalid_json():
    client, _ = fake_client("not json at all")
    with pytest.raises(ScriptError, match="invalid JSON"):
        AnthropicScriptWriter(client=client).write("Ocean", "", ScriptConfig())


def test_anthropic_writer_rejects_a_response_with_no_beats():
    client, _ = fake_client(json.dumps(dict(PAYLOAD, beats=[])))
    with pytest.raises(ScriptError, match="no hook or no beats"):
        AnthropicScriptWriter(client=client).write("Ocean", "", ScriptConfig())


def test_anthropic_writer_surfaces_a_refusal():
    client, _ = fake_client(json.dumps(PAYLOAD), stop_reason="refusal")
    with pytest.raises(ScriptError, match="declined"):
        AnthropicScriptWriter(client=client).write("Ocean", "", ScriptConfig())


def test_template_writer_builds_beats_from_the_summary():
    script = TemplateScriptWriter().write(
        "Octopus",
        "The octopus has three hearts. It can taste with its arms. Its blood is blue.",
        ScriptConfig(),
    )
    assert script.writer == "template"
    assert "three hearts" in script.narration()
    assert script.beats


def test_template_writer_still_produces_a_script_with_no_summary():
    script = TemplateScriptWriter().write("Octopus", "", ScriptConfig())
    assert len(script.beats) >= 2
    assert script.narration()


def test_template_writer_respects_the_word_budget():
    summary = " ".join(f"Sentence number {i} about the topic." for i in range(60))
    cfg = ScriptConfig(target_seconds=20, words_per_second=2.5)
    script = TemplateScriptWriter().write("Topic", summary, cfg)
    # It stops adding beats once the budget is spent, allowing one overshoot.
    assert script.word_count() < word_budget(cfg) * 2


def test_get_writer_honours_an_explicit_choice():
    assert get_writer(ScriptConfig(writer="template")).name == "template"
    assert get_writer(ScriptConfig(writer="anthropic"), api_key="k").name == "anthropic"


def test_get_writer_auto_falls_back_without_a_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert get_writer(ScriptConfig(writer="auto")).name == "template"


def test_get_writer_auto_uses_the_model_when_a_key_exists(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    assert get_writer(ScriptConfig(writer="auto")).name == "anthropic"


def test_get_writer_rejects_an_unknown_name():
    with pytest.raises(ScriptError):
        get_writer(ScriptConfig(writer="nope"))


def test_write_script_falls_back_when_the_api_call_raises():
    class Exploding:
        name = "anthropic"

        def write(self, *args, **kwargs):
            raise RuntimeError("connection reset")

    script = write_script("Octopus", "It has three hearts.", ScriptConfig(), writer=Exploding())
    assert script.writer == "template"


def test_write_script_propagates_a_deliberate_script_error():
    class Refusing:
        name = "anthropic"

        def write(self, *args, **kwargs):
            raise ScriptError("model declined this topic")

    with pytest.raises(ScriptError):
        write_script("Octopus", "", ScriptConfig(), writer=Refusing())
