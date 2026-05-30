# MentorOS — System Architecture Document

**Version:** 1.0  
**Date:** 2026-05-30

---

## 1. Architecture Overview

MentorOS follows a **polyglot microservices architecture** with an event-driven AI processing pipeline. The system is decomposed into distinct service boundaries aligned with both business domains and computational characteristics.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  Next.js 14 (App Router)  │  REST API Consumers  │  WebSocket  │
└──────────────┬──────────────────────┬───────────────────┬───────┘
               │                      │                   │
               ▼                      ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                             │
│         Nginx / Kong │ Rate Limiting │ Auth │ Routing           │
└──────────────┬───────────────────────────────────────────────── ┘
               │
       ┌───────┴────────────────────────────────────┐
       ▼                                            ▼
┌──────────────────────┐              ┌─────────────────────────┐
│   FASTAPI SERVICE    │              │   WEBSOCKET SERVICE     │
│  (Primary API)       │              │  (Real-time Updates)    │
│  Port: 8000          │              │  Port: 8001             │
└──────┬───────────────┘              └──────────┬──────────────┘
       │                                         │
       ▼                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGE QUEUE (Redis)                      │
│         video.process │ analysis.complete │ wisdom.generate     │
└──────────────────────────────────┬──────────────────────────── ┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
┌─────────────────────────┐             ┌───────────────────────┐
│   VIDEO WORKER          │             │   WISDOM WORKER       │
│   (GPU-optimized)       │             │   (LLM-optimized)     │
│   Celery + CUDA         │             │   Celery + vLLM       │
└─────────┬───────────────┘             └──────────┬────────────┘
          │                                        │
          ▼                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI PIPELINE                              │
│  Frame Extraction → Transcript → Pose → Action → Principle      │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────┐
          ▼                        ▼                    ▼
┌─────────────────┐    ┌────────────────────┐  ┌──────────────────┐
│  PostgreSQL     │    │     Neo4j          │  │  Redis           │
│  + pgvector     │    │  (Wisdom Graph)    │  │  Cache + Queue   │
│  (Primary DB)   │    │                    │  │                  │
└─────────────────┘    └────────────────────┘  └──────────────────┘
```

---

## 2. Service Architecture

### 2.1 API Service (FastAPI)

**Role:** Primary HTTP/WebSocket entry point for all client interactions.

**Responsibilities:**
- User authentication and authorization (JWT)
- Video ingestion (URL + file upload)
- Async job dispatch to Redis queues
- REST API for all data retrieval
- WebSocket connections for real-time status

**Technology Choices:**
- FastAPI: Async-native, OpenAPI generation, excellent performance
- Uvicorn + Gunicorn: Production ASGI server
- Pydantic v2: Request/response validation with performance
- SQLAlchemy 2.0: Async ORM with PostgreSQL

### 2.2 Video Processing Worker

**Role:** GPU-accelerated AI pipeline execution.

**Responsibilities:**
- Video download (yt-dlp)
- Frame extraction (FFmpeg)
- Audio extraction and transcription (Whisper)
- Pose detection (MediaPipe + YOLO)
- Scene segmentation
- Action classification (MMAction2)
- Emotion analysis

**Technology Choices:**
- Celery: Battle-tested distributed task queue
- CUDA-optimized containers
- Model serving via local inference (no external API dependency)

### 2.3 Wisdom Generation Worker

**Role:** LLM-based insight extraction and cross-domain mapping.

**Responsibilities:**
- Intent inference from action sequences
- Principle mapping
- Wisdom text generation
- Cross-domain application generation
- Knowledge graph population

**Technology Choices:**
- vLLM for efficient LLM inference
- Qwen2.5-72B as primary LLM (reasoning quality)
- Structured output generation (JSON mode)

### 2.4 WebSocket Service

**Role:** Real-time bidirectional communication.

**Responsibilities:**
- Processing progress streaming
- Chat session management
- Live annotation updates

---

## 3. AI Architecture

### 3.1 Model Selection Rationale

#### Video Understanding: Qwen2.5-VL-72B
**Why:** Best-in-class video comprehension as of 2025. Handles long-context video understanding natively. Outperforms VideoLLaMA3 on temporal understanding benchmarks.
**Alternative:** VideoLLaMA3-7B for edge/fast processing
**Tradeoff:** 72B requires A100 GPU; 7B runs on RTX 3090

#### Speech: Whisper large-v3-turbo
**Why:** OpenAI's latest model. 6x faster than large-v3 with comparable accuracy. Word-level timestamps critical for timeline alignment.
**Alternative:** faster-whisper for CPU-constrained environments
**Tradeoff:** Turbo slightly less accurate on accented speech

#### Pose Detection: MediaPipe + YOLO11-pose
**Why:** MediaPipe provides holistic pose (body + hands + face). YOLO11-pose provides superior multi-person detection.
**Architecture:** Run both; MediaPipe for single-person detailed analysis, YOLO for multi-person scenes

#### Action Recognition: MMAction2 + VideoMAE
**Why:** MMAction2 is the most comprehensive action recognition framework. VideoMAE provides self-supervised representations for novel action detection.
**Fine-tuning:** Fine-tune on martial arts action datasets

#### LLM: Qwen2.5-72B-Instruct
**Why:** Best open-source reasoning model as of 2025. Superior structured output generation. Excellent at multi-step reasoning required for wisdom extraction.
**Alternative:** Llama 3.3-70B (more permissive license)
**Tradeoff:** Memory-intensive; requires tensor parallelism

#### Embeddings: BGE-M3
**Why:** Multi-lingual, multi-granularity embeddings. State-of-the-art on MTEB benchmark. Supports 8192 token context.
**Alternative:** OpenAI text-embedding-3-large (external API dependency)

### 3.2 Agent Architecture

MentorOS uses a **multi-agent orchestration pattern** where specialized agents collaborate through a shared state store.

```
┌──────────────────────────────────────────────────┐
│                  ORCHESTRATOR AGENT               │
│  Coordinates pipeline; routes to specialist agents │
└────────────────────────┬─────────────────────────┘
                         │
    ┌────────────────────┼────────────────────────┐
    ▼                    ▼                        ▼
┌──────────┐    ┌──────────────┐         ┌──────────────┐
│ VIDEO    │    │   ACTION     │         │  PRINCIPLE   │
│ AGENT    │    │   AGENT      │         │  AGENT       │
│          │    │              │         │              │
│ Extracts │    │ Interprets   │         │ Maps to BL   │
│ visual   │    │ movement     │         │ taxonomy     │
│ features │    │ patterns     │         │              │
└──────────┘    └──────────────┘         └──────────────┘
    ▼                    ▼                        ▼
┌──────────┐    ┌──────────────┐         ┌──────────────┐
│  INTENT  │    │   WISDOM     │         │  CROSS-      │
│  AGENT   │    │   AGENT      │         │  DOMAIN      │
│          │    │              │         │  AGENT       │
│ Infers   │    │ Generates    │         │              │
│ tactical │    │ natural lang │         │ Translates   │
│ intent   │    │ insights     │         │ to domains   │
└──────────┘    └──────────────┘         └──────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │     MENTOR AGENT     │
              │                      │
              │  Conversational      │
              │  interface with RAG  │
              │  grounding           │
              └──────────────────────┘
```

### 3.3 RAG Architecture

```
Query
  │
  ▼
Query Embedding (BGE-M3)
  │
  ▼
Vector Search (pgvector) ──────► Top-K Wisdom Chunks
  │
  ▼
Graph Traversal (Neo4j) ──────► Related Principles/Examples
  │
  ▼
Context Assembly
  │
  ▼
LLM Generation (Qwen2.5)
  │
  ▼
Response with Citations + Confidence Score
```

---

## 4. Data Flow

### 4.1 Video Processing Flow

```
1. User submits YouTube URL
   │
   ├─► Validate URL
   ├─► Create video record (PostgreSQL: status=QUEUED)
   └─► Dispatch to video.download queue (Redis)

2. Video Worker picks up job
   │
   ├─► Download video (yt-dlp) → Object Storage
   ├─► Update status: DOWNLOADING
   ├─► Extract audio stream (FFmpeg)
   ├─► Extract frames at 1fps + scene boundaries
   └─► Update status: TRANSCRIBING

3. Audio Pipeline
   │
   ├─► Whisper transcription (word-level timestamps)
   ├─► Speaker diarization (pyannote)
   └─► Store transcript segments (PostgreSQL)

4. Vision Pipeline
   │
   ├─► Scene segmentation (PySceneDetect)
   ├─► Per-scene: Pose detection (MediaPipe + YOLO)
   ├─► Per-scene: Action classification (MMAction2)
   ├─► Per-scene: Emotion detection
   └─► Store scene annotations (PostgreSQL)

5. Dispatch to wisdom.generate queue (Redis)

6. Wisdom Worker
   │
   ├─► Qwen2.5-VL scene understanding
   ├─► Intent inference (LLM + pose data)
   ├─► Principle mapping (LLM + taxonomy)
   ├─► Wisdom text generation
   ├─► Cross-domain application generation
   ├─► Embedding generation (BGE-M3)
   ├─► Store in Neo4j (knowledge graph)
   ├─► Store embeddings (pgvector)
   └─► Update status: COMPLETE

7. WebSocket notification to client
```

### 4.2 Chat Query Flow

```
User Query
  │
  ▼
Intent Classification
  │
  ├─► Timestamp query → Video timeline retrieval
  ├─► Principle query → Graph traversal
  └─► Application query → Cross-domain lookup

  ▼
Hybrid Retrieval
  ├─► Vector search (semantic similarity)
  └─► Graph traversal (relationship-aware)

  ▼
Context Assembly (relevant clips, principles, applications)

  ▼
LLM Generation with grounding constraint:
  "Only use information from the retrieved context.
   Acknowledge uncertainty if context is insufficient."

  ▼
Stream response with citations
```

---

## 5. Technology Stack

### Core
| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| Backend API | FastAPI | 0.115+ | Async, type-safe, OpenAPI |
| Frontend | Next.js | 14+ | App Router, RSC, streaming |
| Primary DB | PostgreSQL | 16+ | ACID, pgvector extension |
| Vector DB | pgvector | 0.7+ | Integrated with PostgreSQL |
| Graph DB | Neo4j | 5.x | Native graph, Cypher query |
| Cache/Queue | Redis | 7.x | Streams, pub/sub, caching |
| Task Queue | Celery | 5.x | Distributed workers |
| Object Storage | MinIO / S3 | - | Video + artifact storage |

### AI/ML
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Video LLM | Qwen2.5-VL-72B | Video understanding |
| Speech | Whisper large-v3-turbo | Transcription |
| Pose | MediaPipe Holistic | Skeletal tracking |
| Pose (multi) | YOLO11-pose | Multi-person detection |
| Action | MMAction2 + VideoMAE | Action classification |
| LLM | Qwen2.5-72B-Instruct | Wisdom generation |
| Embeddings | BGE-M3 | Semantic search |
| Inference | vLLM | GPU-optimized serving |

### Infrastructure
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Container | Docker + Compose | Development |
| Orchestration | Kubernetes | Production |
| CI/CD | GitHub Actions | Automation |
| Metrics | Prometheus + Grafana | Monitoring |
| Tracing | OpenTelemetry + Jaeger | Distributed tracing |
| Errors | Sentry | Error tracking |
| Secrets | HashiCorp Vault / K8s Secrets | Secret management |

---

## 6. Deployment Architecture

### Development
```
docker-compose.yml
  ├── api (FastAPI, port 8000)
  ├── websocket (port 8001)
  ├── worker-video (Celery, GPU)
  ├── worker-wisdom (Celery, GPU)
  ├── postgres (port 5432)
  ├── redis (port 6379)
  ├── neo4j (ports 7474, 7687)
  ├── minio (ports 9000, 9001)
  └── web (Next.js, port 3000)
```

### Production (Kubernetes)
```
Namespace: mentorios-prod
  ├── Deployments
  │   ├── api (3 replicas, HPA: 3-10)
  │   ├── worker-video (2 replicas, GPU nodes)
  │   ├── worker-wisdom (2 replicas, GPU nodes)
  │   └── web (3 replicas, HPA: 3-15)
  ├── StatefulSets
  │   ├── postgres (1 primary + 2 replicas)
  │   ├── redis (3-node cluster)
  │   └── neo4j (3-node cluster)
  └── Services
      ├── LoadBalancer (external ingress)
      ├── ClusterIP (internal services)
      └── NodePort (debugging)
```

---

## 7. Security Architecture

- **Authentication:** JWT (RS256) with refresh token rotation
- **Authorization:** RBAC with resource-level permissions
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Secrets:** Environment-injected via Kubernetes Secrets / Vault
- **Network:** Service mesh (Istio) for mTLS between services
- **API:** Rate limiting (100 req/min default), IP allowlisting for admin
- **Audit:** All mutations logged with user, timestamp, and payload hash

---

*End of Architecture Document v1.0*
