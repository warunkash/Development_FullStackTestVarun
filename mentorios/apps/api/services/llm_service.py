"""LLM service — unified interface for local vLLM and remote API inference."""

import json
import logging
from typing import Any, AsyncIterator

import httpx

from core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class LLMService:
    """Unified LLM client supporting vLLM (OpenAI-compatible) and Anthropic APIs."""

    def __init__(self):
        self.base_url = settings.vllm_base_url
        self.api_key = settings.vllm_api_key

    async def chat(
        self,
        model: str,
        system: str,
        message: str | None = None,
        messages: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: dict | None = None,
    ) -> str:
        """Non-streaming chat completion."""
        payload = self._build_payload(
            model=model,
            system=system,
            message=message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            stream=False,
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def stream_chat(
        self,
        model: str,
        system: str,
        message: str | None = None,
        messages: list[dict] | None = None,
        temperature: float = 0.5,
        max_tokens: int = 1500,
    ) -> AsyncIterator[str]:
        """Streaming chat completion via SSE."""
        payload = self._build_payload(
            model=model,
            system=system,
            message=message,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0]["delta"]
                            if "content" in delta and delta["content"]:
                                yield delta["content"]
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

    def _build_payload(
        self,
        model: str,
        system: str,
        message: str | None,
        messages: list[dict] | None,
        temperature: float,
        max_tokens: int,
        response_format: dict | None = None,
        stream: bool = False,
    ) -> dict:
        if messages:
            all_messages = [{"role": "system", "content": system}, *messages]
        else:
            all_messages = [
                {"role": "system", "content": system},
                {"role": "user", "content": message or ""},
            ]

        payload: dict[str, Any] = {
            "model": model,
            "messages": all_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

        if response_format:
            payload["response_format"] = response_format

        return payload


class EmbeddingService:
    """Generate text embeddings using BGE-M3."""

    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            log.info("Loading BGE-M3 embedding model")
            try:
                from FlagEmbedding import BGEM3FlagModel

                cls._model = BGEM3FlagModel(
                    settings.embedding_model,
                    use_fp16=settings.device == "cuda",
                )
            except ImportError:
                from sentence_transformers import SentenceTransformer

                cls._model = SentenceTransformer(settings.embedding_model)
            log.info("Embedding model loaded")
        return cls._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        model = self.get_model()
        try:
            # FlagEmbedding interface
            output = model.encode(
                texts,
                batch_size=12,
                max_length=512,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            return output["dense_vecs"].tolist()
        except AttributeError:
            # SentenceTransformer interface
            return model.encode(texts, normalize_embeddings=True).tolist()

    def embed_single(self, text: str) -> list[float]:
        return self.embed([text])[0]
