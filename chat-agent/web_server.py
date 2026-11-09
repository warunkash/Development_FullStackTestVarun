#!/usr/bin/env python3
"""Web version of the chat agent: talk to it in the browser.

    export ANTHROPIC_API_KEY=sk-ant-...
    export OPENAI_API_KEY=sk-...        # optional: natural-sounding voice (OpenAI TTS)
    pip install -r requirements-web.txt
    python web_server.py                # then open http://localhost:8000

Speech-to-text runs in the browser (Web Speech API; use Chrome, Edge or Safari).
Replies are spoken with OpenAI TTS if OPENAI_API_KEY is set, otherwise with the
best voice your browser offers.
"""
import json
import os
from pathlib import Path

import anthropic
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from chat_agent import MAX_TOKENS, MODEL, SYSTEM_PROMPT, window

STATIC = Path(__file__).with_name("static")
SESSIONS_FILE = Path(os.environ.get("CHAT_AGENT_WEB_HISTORY", Path(__file__).with_name("history_web.json")))
TTS_MODEL = os.environ.get("CHAT_AGENT_TTS_MODEL", "gpt-4o-mini-tts")
TTS_VOICE = os.environ.get("CHAT_AGENT_TTS_VOICE", "nova")

app = FastAPI()
client = anthropic.Anthropic() if os.environ.get("ANTHROPIC_API_KEY") else None
try:
    sessions: dict[str, list[dict]] = json.loads(SESSIONS_FILE.read_text())
except (FileNotFoundError, json.JSONDecodeError):
    sessions = {}


def persist() -> None:
    SESSIONS_FILE.write_text(json.dumps(sessions, ensure_ascii=False))


class ChatIn(BaseModel):
    session: str = Field(min_length=1, max_length=64, pattern=r"^[\w-]+$")
    message: str = Field(min_length=1, max_length=8000)


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/config")
def config():
    return {"neural_tts": bool(os.environ.get("OPENAI_API_KEY")), "model": MODEL}


@app.get("/api/history/{session}")
def history(session: str):
    return sessions.get(session, [])


@app.post("/api/reset/{session}")
def reset(session: str):
    sessions.pop(session, None)
    persist()
    return {"ok": True}


@app.post("/api/chat")
def chat(body: ChatIn):
    if client is None:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set on the server")
    messages = sessions.setdefault(body.session, [])
    messages.append({"role": "user", "content": body.message})

    def stream():
        reply = ""
        try:
            with client.messages.stream(
                model=MODEL, max_tokens=MAX_TOKENS, system=SYSTEM_PROMPT, messages=window(messages)
            ) as s:
                for text in s.text_stream:
                    reply += text
                    yield text
        except anthropic.APIError as e:
            messages.pop()
            yield f"\n[API error: {e}]"
            return
        finally:
            if reply:
                messages.append({"role": "assistant", "content": reply})
                persist()
            elif messages and messages[-1]["role"] == "user":
                messages.pop()

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")


@app.post("/api/tts")
def tts(body: TtsIn):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(501, "Neural TTS not configured")
    r = httpx.post(
        "https://api.openai.com/v1/audio/speech",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": TTS_MODEL,
            "voice": TTS_VOICE,
            "input": body.text,
            "response_format": "mp3",
            "instructions": "Speak warmly and naturally, like a friendly person in conversation.",
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"TTS provider error {r.status_code}")
    return Response(r.content, media_type="audio/mpeg")


if __name__ == "__main__":
    uvicorn.run(app, host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "8000")))
