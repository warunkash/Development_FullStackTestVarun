# MentorOS — AI Architecture Design

**Version:** 1.0  
**Date:** 2026-05-30

---

## 1. Model Selection Matrix

| Task | Selected Model | Rationale | Alternative | VRAM Required |
|------|----------------|-----------|-------------|---------------|
| Video Understanding | Qwen2.5-VL-72B | Best video comprehension, SOTA on Video-MME | VideoLLaMA3-7B | 4×A100 |
| Speech-to-Text | faster-whisper large-v3-turbo | 6× faster than Whisper large-v3, comparable accuracy | faster-whisper medium | 6GB |
| Pose Detection | MediaPipe Holistic | 33 landmarks + hands + face | YOLOv8-pose | CPU/GPU |
| Multi-person Pose | YOLO11x-pose | Best multi-person detection | ViTPose | 8GB |
| Action Classification | MMAction2 + VideoMAE | Comprehensive framework + self-supervised | R3D, SlowFast | 12GB |
| Text LLM | Qwen2.5-72B-Instruct | Best open-source reasoning | Llama 3.3-70B | 4×A100 |
| Embeddings | BGE-M3 | Multi-granularity, MTEB SOTA | OpenAI ada-003 | 8GB |
| LLM Inference | vLLM | PagedAttention, continuous batching | Text Generation Inference | - |
| Emotion Analysis | deepface + PyFeat | Multi-model ensemble | FER+ | 4GB |

---

## 2. Pipeline Architecture

### 2.1 Video Processing Pipeline (GPU Worker)

```
Input: Video file path
        │
        ├─► Audio Pipeline
        │     ├── FFmpeg audio extraction → WAV (16kHz, mono)
        │     ├── faster-whisper transcription (word timestamps)
        │     └── pyannote speaker diarization
        │
        ├─► Frame Pipeline
        │     ├── FFmpeg frame extraction (1 FPS baseline)
        │     ├── PySceneDetect AdaptiveDetector
        │     └── Keyframe extraction (midpoint per scene)
        │
        └─► Vision Pipeline (per scene)
              ├── MediaPipe Holistic (pose + hands + face)
              ├── YOLO11x-pose (multi-person)
              ├── MMAction2 (action classification)
              └── Emotion analysis (deepface)
```

### 2.2 Wisdom Generation Pipeline (LLM Worker)

```
Input: Scene data, actions, transcript
        │
        ├─► Scene Context Assembly
        │     ├── Structured action descriptions
        │     ├── Pose feature extraction
        │     └── Transcript alignment
        │
        ├─► Qwen2.5-VL Scene Understanding
        │     └── Visual description with timing context
        │
        ├─► Intent Inference (Qwen2.5-72B)
        │     ├── System: Intent analysis expert
        │     ├── Context: Actions + pose + transcript
        │     └── Output: Structured intent JSON
        │
        ├─► Principle Mapping (Qwen2.5-72B)
        │     ├── System: Bruce Lee taxonomy expert
        │     ├── Context: Intent + actions + transcript
        │     └── Output: Principle codes + confidence
        │
        └─► Wisdom Generation (Qwen2.5-72B)
              ├── System: Wisdom synthesis expert
              ├── Context: Intent + principles + evidence
              └── Output: Insight + cross-domain applications
```

### 2.3 RAG Pipeline (Chat Query)

```
User Query
    │
    ├─► Query Embedding (BGE-M3)
    │
    ├─► Parallel Retrieval
    │     ├── pgvector ANN search (top-10 semantic matches)
    │     ├── PostgreSQL full-text search (keyword matches)
    │     └── Neo4j graph traversal (principle relationships)
    │
    ├─► Context Ranking (RRF - Reciprocal Rank Fusion)
    │
    ├─► Context Assembly (top-5 items)
    │
    ├─► Prompt Construction
    │     ├── System: Mentor agent persona
    │     ├── Evidence: Retrieved context
    │     └── History: Last 20 messages
    │
    └─► LLM Generation (Qwen2.5-72B streaming)
          └── Citations extracted from response
```

---

## 3. Prompt Engineering

### 3.1 System Prompts Design Principles

- **Grounding constraint**: Always reference provided context
- **Uncertainty acknowledgment**: Explicit permission to say "I don't know"
- **Citation requirement**: Must reference timestamps/sources
- **Confidence language**: Calibrated uncertainty markers
- **Role consistency**: Consistent mentor persona across conversations

### 3.2 Structured Output Strategy

All wisdom extraction uses JSON mode (response_format={"type":"json_object"}) with:
- Required fields validated before storage
- Invalid principle codes filtered (whitelist validation)
- Confidence scores clamped to [0, 1]
- Fallback to None on parsing failure (no silent errors)

### 3.3 Prompt Chaining Architecture

```python
chain = (
    ContextAssembler()
    | IntentExtractionPrompt()
    | PrincipleMapperPrompt()
    | WisdomSynthesizerPrompt()
    | CrossDomainApplicationPrompt()
)
```

Each stage receives previous stage output as verified, structured input.

---

## 4. Model Serving Architecture

### 4.1 vLLM Configuration

```yaml
engine: vllm
model: Qwen/Qwen2.5-72B-Instruct
tensor_parallel_size: 4          # 4 × A100 80GB
max_model_len: 32768             # 32K context
gpu_memory_utilization: 0.90
max_num_seqs: 256                # Concurrent sequences
enable_prefix_caching: true      # KV cache reuse
quantization: awq                # 4-bit AWQ for 2× throughput
dtype: float16
```

### 4.2 Model Loading Strategy

```
Startup sequence:
1. Load embedding model (BGE-M3) → GPU 0
2. Load Whisper model (large-v3-turbo) → GPU 0
3. Load MediaPipe (CPU)
4. Load YOLO11-pose → GPU 0
5. Start vLLM server → GPU 0-3 (tensor parallel)
6. Health check all models
7. Accept traffic
```

### 4.3 Inference Optimization

| Technique | Benefit | Applied To |
|-----------|---------|-----------|
| AWQ 4-bit quantization | 2× throughput, ~50% memory | LLM |
| KV cache prefix sharing | 30-40% cache hit on system prompts | LLM |
| FP16 embeddings | 2× speed vs FP32 | BGE-M3 |
| CTranslate2 | 3-4× vs PyTorch Whisper | Whisper |
| Batched inference | Amortize GPU overhead | All models |
| torch.compile | 20-30% GPU utilization | Pose models |

---

## 5. AI Evaluation Framework

### 5.1 Wisdom Quality Metrics

```python
class WisdomEvaluation:
    grounding_score: float        # 0-1: Is insight traceable to evidence?
    principle_accuracy: float     # Human eval: Correct principle mapping?
    insight_quality: float        # Human eval: Is insight genuinely useful?
    application_relevance: float  # Human eval: Cross-domain application accuracy
    hallucination_rate: float     # Rate of fabricated claims
```

### 5.2 Evaluation Test Set

- 50 manually annotated Bruce Lee video segments
- Ground truth principle labels from martial arts experts
- Cross-domain application quality rated by domain experts
- Hallucination detection by independent human evaluators
- Target: > 80% principle accuracy, < 5% hallucination rate

### 5.3 Continuous Evaluation Pipeline

```
Every 100 new videos processed:
  → Sample 5% of generated insights
  → Run automated hallucination detection (NLI model)
  → Flag low-confidence insights for human review
  → Update evaluation metrics dashboard
  → Alert on regression > 5% from baseline
```

---

## 6. Fine-tuning Strategy

### 6.1 Action Classification Fine-tuning

**Dataset construction:**
- Download public martial arts action datasets (UCF-101 martial arts split)
- Collect manually labeled Bruce Lee action clips
- Augment with pose-based synthetic labels

**Training approach:**
- Start from VideoMAE pretrained weights
- Fine-tune classification head on martial arts taxonomy
- Use temporal shift module for efficient video processing

### 6.2 Principle Mapping Fine-tuning (Future)

**Dataset construction:**
- Expert-labeled principle examples (50 examples per principle)
- Negative examples (actions that DON'T demonstrate principle)
- Comparative examples (similar actions, different principles)

**Training approach:**
- Instruction fine-tuning on Qwen2.5-7B
- Reduces dependency on 72B for routine principle mapping
- 7B handles 90% of cases; 72B handles complex/ambiguous

---

*End of AI Architecture v1.0*
