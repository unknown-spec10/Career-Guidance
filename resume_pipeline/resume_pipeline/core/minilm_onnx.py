"""Offline MiniLM sentence embeddings via ONNX Runtime — the single path.

This module is the backend's only text-embedding implementation: both the
recommendation ``Embedder`` and the semantic skill matcher funnel through
:func:`get_encoder`. There is no second backend and no deep-learning framework
at runtime.

Weights come from the pre-exported ``onnx/model.onnx`` published (Apache-2.0)
in the public ``sentence-transformers/all-MiniLM-L6-v2`` HuggingFace repo —
the same weights and tokenizer the previous stack loaded, so vectors are
identical within fp32 noise.

Assets are resolved through ``huggingface_hub``, which honours
``HF_HOME`` / ``HF_HUB_CACHE``. The Docker build pre-bakes them into the image
cache (see ``resume_pipeline/Dockerfile``), so a cached run — container or
dev box — resolves locally with no network call.

Pooling matches the model's ``modules.json`` pipeline: mean over token
embeddings weighted by the attention mask, 256-token truncation, then L2
normalization — the same ``Pooling`` + ``Normalize`` stages the tensor build
applied, so vectors are identical within fp32 noise.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
MAX_SEQ_LENGTH = 256

_HF_REPO_ID = f"sentence-transformers/{MODEL_NAME}"
_ONNX_FILENAME = "onnx/model.onnx"
_TOKENIZER_FILENAME = "tokenizer.json"

try:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    from tokenizers import Tokenizer
except ImportError as exc:  # pragma: no cover - dependency guard
    ort = None  # type: ignore[assignment]
    hf_hub_download = None  # type: ignore[assignment]
    Tokenizer = None  # type: ignore[assignment]
    _IMPORT_ERROR: Optional[str] = str(exc)
else:
    _IMPORT_ERROR = None


class EmbeddingModelUnavailable(RuntimeError):
    """Raised when the ONNX MiniLM encoder cannot be loaded or executed."""


def is_available() -> bool:
    """True when the ONNX inference stack is importable."""
    return _IMPORT_ERROR is None


class MiniLMEncoder:
    """Sentence encoder over the pre-exported MiniLM ONNX graph."""

    def __init__(self, model_path: Path, tokenizer_path: Path) -> None:
        session = ort.InferenceSession(
            str(model_path), providers=["CPUExecutionProvider"]
        )
        output_dim = session.get_outputs()[0].shape[-1]
        if output_dim != EMBEDDING_DIM:
            raise EmbeddingModelUnavailable(
                f"{model_path} emits {output_dim}-dim vectors, expected {EMBEDDING_DIM}"
            )
        tokenizer = Tokenizer.from_file(str(tokenizer_path))
        tokenizer.enable_truncation(max_length=MAX_SEQ_LENGTH)
        tokenizer.enable_padding()  # batch inputs to the longest sequence
        self._session = session
        self._input_names: List[str] = [i.name for i in session.get_inputs()]
        self._tokenizer = tokenizer

    def encode(self, text: str) -> np.ndarray:
        """Encode one string into a 384-dim ``float32`` vector."""
        return self.encode_batch([text])[0]

    def encode_batch(self, texts: Sequence[str]) -> np.ndarray:
        """Encode strings into an ``(n, 384)`` ``float32`` array."""
        encodings = self._tokenizer.encode_batch(list(texts))
        input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)
        feeds: Dict[str, np.ndarray] = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        }
        if "token_type_ids" in self._input_names:
            feeds["token_type_ids"] = np.zeros_like(input_ids)
        hidden = self._session.run(None, feeds)[0]  # (batch, tokens, 384)
        mask = attention_mask[..., None].astype(np.float32)
        pooled = (hidden * mask).sum(axis=1) / np.clip(mask.sum(axis=1), 1e-9, None)
        # The model's pipeline ends with a Normalize module (modules.json).
        norms = np.linalg.norm(pooled, axis=1, keepdims=True)
        return (pooled / np.clip(norms, 1e-12, None)).astype(np.float32)


_encoder: Optional[MiniLMEncoder] = None
_encoder_lock = threading.Lock()


def _resolve_asset(filename: str) -> Path:
    """Return a cached HF asset path, downloading only on a cold cache."""
    try:
        return Path(hf_hub_download(_HF_REPO_ID, filename, local_files_only=True))
    except Exception:
        logger.info(
            "MiniLM ONNX asset '%s' not in the local HF cache; downloading from %s",
            filename,
            _HF_REPO_ID,
        )
        try:
            return Path(hf_hub_download(_HF_REPO_ID, filename))
        except Exception as exc:
            raise EmbeddingModelUnavailable(
                f"Could not resolve '{filename}' for {MODEL_NAME}: {exc}"
            ) from exc


def _load_encoder() -> MiniLMEncoder:
    if not is_available():
        raise EmbeddingModelUnavailable(
            f"onnxruntime/tokenizers/huggingface_hub unavailable ({_IMPORT_ERROR})"
        )
    encoder = MiniLMEncoder(
        model_path=_resolve_asset(_ONNX_FILENAME),
        tokenizer_path=_resolve_asset(_TOKENIZER_FILENAME),
    )
    logger.info("Loaded ONNX MiniLM encoder: %s", MODEL_NAME)
    return encoder


def get_encoder() -> MiniLMEncoder:
    """Return the process-wide encoder, loading it on first use."""
    global _encoder
    if _encoder is not None:
        return _encoder
    with _encoder_lock:
        if _encoder is None:
            _encoder = _load_encoder()
    return _encoder


if __name__ == "__main__":
    # Docker build pre-bake entry point: populates the HF cache with the ONNX
    # graph + tokenizer so container cold starts never hit the network.
    logging.basicConfig(level=logging.INFO)
    print(f"MiniLM ONNX pre-bake OK: dim={get_encoder().encode('warm up').shape[0]}")
