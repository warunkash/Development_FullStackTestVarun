# MentorOS — Human Wisdom Intelligence Platform

> **Video → Action → Intent → Principle → Wisdom → Application**

MentorOS converts video of the world's greatest masters into structured, queryable, cross-domain wisdom — grounded in evidence and applicable everywhere.

**Initial Mentor:** Bruce Lee  
**Status:** MVP Development

---

## What MentorOS Does

1. **Ingest** a YouTube URL or uploaded video
2. **Extract** audio, transcription, scenes, poses, and actions
3. **Infer** intent behind each action
4. **Map** actions to Bruce Lee's wisdom taxonomy (15 principles)
5. **Generate** cross-domain applications (business, investing, leadership, relationships, growth)
6. **Store** everything in a searchable knowledge graph
7. **Answer** your questions with grounded, cited responses

---

## Quick Start (Development)

### Prerequisites
- Docker + Docker Compose
- NVIDIA GPU (optional — CPU mode works for development)
- 16GB RAM minimum, 32GB recommended
- 50GB disk space

### 1. Clone and configure

```bash
git clone https://github.com/warunkash/development_fullstacktestvarun.git
cd mentorios
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start infrastructure

```bash
# Start databases, storage, and API (no GPU required)
docker compose up -d postgres redis neo4j minio api web

# Wait for services to be healthy
docker compose ps

# Run database migrations
docker compose exec api alembic upgrade head

# Seed initial data
docker compose exec api python scripts/seed.py
```

### 3. Start workers (optional — requires more RAM)

```bash
# CPU workers (no GPU)
docker compose --profile workers up -d worker-video worker-wisdom

# GPU workers (NVIDIA required)
DEVICE=cuda docker compose --profile workers --profile gpu up -d
```

### 4. Access the platform

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API Docs | http://localhost:8000/api/docs |
| Neo4j Browser | http://localhost:7474 |
| MinIO Console | http://localhost:9001 |
| Grafana | http://localhost:3001 |

---

## Repository Structure

```
mentorios/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── main.py             # Application entry point
│   │   ├── core/               # Config, database, security
│   │   ├── routers/            # API route handlers
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── services/           # Business logic layer
│   │   ├── agents/             # AI agent implementations
│   │   ├── pipeline/           # AI processing pipeline
│   │   │   ├── video/          # Download, frame extraction
│   │   │   ├── audio/          # Whisper transcription
│   │   │   ├── vision/         # Scene detection, pose analysis
│   │   │   ├── action/         # Action detection
│   │   │   └── wisdom/         # LLM wisdom extraction
│   │   ├── workers/            # Celery tasks
│   │   └── tests/              # Test suite
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # Next.js App Router pages
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks
│           ├── lib/            # Utilities, API client
│           └── types/          # TypeScript types
├── docs/                       # Architecture documentation
│   ├── 01-prd.md
│   ├── 02-architecture.md
│   ├── 03-database-design.md
│   ├── 04-graph-schema.md
│   ├── 05-ai-architecture.md
│   ├── 08-roadmap.md
│   └── 14-mvp-definition.md
├── infrastructure/
│   ├── docker/                 # Dockerfiles
│   ├── kubernetes/             # K8s manifests
│   └── terraform/              # (Future) IaC
├── .github/
│   └── workflows/              # CI/CD pipelines
├── docker-compose.yml          # Development environment
└── README.md
```

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│              Next.js Frontend           │
│  Dashboard │ Wisdom Explorer │ Chat     │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼─────────┐
         │    FastAPI API     │
         │  Auth │ Videos │   │
         │  Wisdom │ Chat     │
         └────┬──────────┬───┘
              │          │
    ┌─────────▼──┐  ┌───▼────────┐
    │ PostgreSQL │  │   Redis    │
    │ + pgvector │  │ Queue/Cache│
    └────────────┘  └────┬───────┘
              │          │
         ┌────▼──────────▼────┐
         │    Celery Workers  │
         │  Video │ Wisdom     │
         └────────────────────┘
              │          │
    ┌─────────▼──┐  ┌───▼────────┐
    │   Neo4j    │  │    vLLM    │
    │  (Wisdom   │  │ (Qwen2.5)  │
    │   Graph)   │  │            │
    └────────────┘  └────────────┘
```

---

## AI Stack

| Component | Model | Purpose |
|-----------|-------|---------|
| Speech | faster-whisper large-v3-turbo | Transcription + timestamps |
| Pose | MediaPipe Holistic + YOLO11-pose | Skeletal tracking |
| Action | Heuristic + MMAction2 | Action classification |
| Video LLM | Qwen2.5-VL-72B | Visual scene understanding |
| LLM | Qwen2.5-72B-Instruct | Wisdom extraction + chat |
| Embeddings | BGE-M3 | Semantic search |
| Serving | vLLM | High-throughput inference |

---

## Documentation

| Document | Location |
|----------|----------|
| Product Requirements | `docs/01-prd.md` |
| System Architecture | `docs/02-architecture.md` |
| Database Design | `docs/03-database-design.md` |
| Graph Schema | `docs/04-graph-schema.md` |
| AI Architecture | `docs/05-ai-architecture.md` |
| Development Roadmap | `docs/08-roadmap.md` |
| MVP Definition + Cost | `docs/14-mvp-definition.md` |

---

## Contributing

This is currently in MVP development. The architecture supports:
- Adding new mentors (extend the taxonomy)
- Adding new wisdom domains (extend `insight_applications`)
- Adding new analysis models (plug into the pipeline)
- Adding new UI views (Next.js App Router pages)

See `docs/08-roadmap.md` for the full development plan.

---

*MentorOS — "Absorb what is useful, discard what is not, add what is uniquely your own." — Bruce Lee*
