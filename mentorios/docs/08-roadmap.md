# MentorOS — Development Roadmap & Sprint Plan

**Version:** 1.0  
**Date:** 2026-05-30

---

## Phase Overview

| Phase | Duration | Focus | Outcome |
|-------|----------|-------|---------|
| 1 | Weeks 1-2 | Repository, Infrastructure, Foundations | Running dev environment |
| 2 | Weeks 3-4 | Video ingestion pipeline | Videos downloading and transcribing |
| 3 | Weeks 5-6 | Computer vision pipeline | Scenes, poses, actions detected |
| 4 | Weeks 7-8 | Action graph generation | Action graph in Neo4j |
| 5 | Weeks 9-10 | Wisdom graph generation | Insights + principles stored |
| 6 | Weeks 11-12 | Mentor chat | Conversational RAG working |
| 7 | Weeks 13-14 | UI polish | Production-ready frontend |
| 8 | Weeks 15-16 | Production deployment | Live on Kubernetes |

---

## Phase 1: Repository & Infrastructure (Weeks 1-2)

### Sprint 1.1 (Days 1-5)
- [x] Create monorepo structure
- [x] Set up Git branching strategy (main/develop/feature)
- [x] Docker Compose for local development
- [x] PostgreSQL + pgvector setup with schema
- [x] Redis configuration
- [x] Neo4j setup with constraints and indexes
- [x] MinIO object storage setup
- [ ] GitHub Actions CI pipeline (lint, test, build)
- [ ] Pre-commit hooks (black, ruff, mypy)

### Sprint 1.2 (Days 6-10)
- [x] FastAPI project structure
- [x] SQLAlchemy models + Alembic migrations
- [x] Authentication system (JWT, bcrypt)
- [x] Celery worker configuration
- [x] Next.js project setup (App Router)
- [x] Tailwind + shadcn/ui components
- [x] Base API routes (health, auth)

**Milestone:** `docker compose up` starts all services; auth works end-to-end.

---

## Phase 2: Video Ingestion Pipeline (Weeks 3-4)

### Sprint 2.1 (Days 11-15)
- [x] YouTube URL ingestion (yt-dlp)
- [x] File upload endpoint
- [x] Storage integration (MinIO upload/download)
- [x] Celery task for video processing
- [x] FFmpeg audio extraction
- [ ] Whisper transcription worker (CPU mode first)
- [ ] Transcript storage (PostgreSQL)

### Sprint 2.2 (Days 16-20)
- [ ] Speaker diarization (pyannote)
- [ ] Real-time processing progress (Redis → WebSocket)
- [ ] Processing status UI (dashboard)
- [ ] Error handling + retry logic
- [ ] Integration test: YouTube URL → transcript stored

**Milestone:** YouTube URL → transcript visible in dashboard within 10 minutes.

---

## Phase 3: Computer Vision Pipeline (Weeks 5-6)

### Sprint 3.1 (Days 21-25)
- [x] Scene segmentation (PySceneDetect)
- [x] Keyframe extraction
- [x] MediaPipe pose detection
- [x] YOLO11-pose multi-person detection
- [ ] Pose data storage (PostgreSQL)

### Sprint 3.2 (Days 26-30)
- [x] Action detection heuristics (velocity-based)
- [ ] MMAction2 integration (action classification)
- [ ] Emotion analysis (deepface)
- [ ] Scene metadata extraction (people count, environment)
- [ ] Timeline visualization (basic version)

**Milestone:** Processed video shows timeline with detected scenes and pose overlays.

---

## Phase 4: Action Graph (Weeks 7-8)

### Sprint 4.1 (Days 31-35)
- [x] Neo4j Video/Scene/Action node creation
- [ ] Action-to-scene relationship population
- [ ] Movement intensity scoring
- [ ] Action sequence detection (combinations)
- [ ] Graph API endpoints (subgraph export)

### Sprint 4.2 (Days 36-40)
- [ ] Action graph visualization (D3.js force-directed)
- [ ] Timeline-to-graph sync (click timestamp → graph highlight)
- [ ] Graph traversal queries (Cypher)
- [ ] Action clustering by type

**Milestone:** Click a video timestamp → see action graph in Neo4j Browser.

---

## Phase 5: Wisdom Graph (Weeks 9-10)

### Sprint 5.1 (Days 41-45)
- [x] Wisdom extraction LLM integration (vLLM/Qwen)
- [x] Intent inference prompts
- [x] Principle mapping prompts
- [x] Insight storage (PostgreSQL + Neo4j)
- [ ] Cross-domain application generation

### Sprint 5.2 (Days 46-50)
- [x] Embedding generation (BGE-M3)
- [x] pgvector storage and indexing
- [x] Semantic search API
- [ ] Principle→Lesson graph population
- [ ] Wisdom Explorer UI (principles, insights, applications)

**Milestone:** Search "adaptability examples" → returns timestamped video clips with wisdom insights.

---

## Phase 6: Mentor Chat (Weeks 11-12)

### Sprint 6.1 (Days 51-55)
- [x] Chat session management
- [x] RAG retrieval (hybrid vector + graph)
- [x] Streaming response (SSE)
- [ ] Citation extraction from LLM responses
- [ ] Confidence score calculation

### Sprint 6.2 (Days 56-60)
- [x] Mentor Agent implementation
- [x] Chat UI (streaming display)
- [ ] Session history persistence
- [ ] Video-specific chat (ask about a specific video)
- [ ] Timestamp-specific chat (ask about a moment)

**Milestone:** Ask "Why did Bruce Lee pause?" → receive grounded answer with timestamp citations.

---

## Phase 7: UI Polish (Weeks 13-14)

### Sprint 7.1 (Days 61-65)
- [ ] Video player with annotation overlay
- [ ] Timeline scrubber with wisdom markers
- [ ] Principle detail pages
- [ ] Cross-domain application browser
- [ ] Mobile responsive design

### Sprint 7.2 (Days 66-70)
- [ ] Dark/light mode
- [ ] Loading states and error boundaries
- [ ] Onboarding flow
- [ ] Performance optimization (React Query, prefetching)
- [ ] Accessibility audit

**Milestone:** Complete user journey: URL paste → processing → explore wisdom → chat.

---

## Phase 8: Production Deployment (Weeks 15-16)

### Sprint 8.1 (Days 71-75)
- [ ] Kubernetes manifests (all services)
- [ ] GPU node pool setup
- [ ] Secrets management (K8s Secrets / Vault)
- [ ] Ingress + TLS (cert-manager + Let's Encrypt)
- [ ] Database migrations in CI/CD

### Sprint 8.2 (Days 76-80)
- [ ] Prometheus + Grafana dashboards
- [ ] OpenTelemetry tracing
- [ ] Sentry error monitoring
- [ ] Load testing (k6 / Locust)
- [ ] Security audit + penetration test
- [ ] Documentation + runbook

**Milestone:** Production deployment processing real videos, monitoring active.

---

## MVP Feature Set

The Minimum Viable Product includes:

| Feature | Priority |
|---------|----------|
| YouTube URL ingestion | P0 |
| Audio transcription (Whisper) | P0 |
| Scene detection | P0 |
| Basic pose analysis | P0 |
| LLM wisdom extraction | P0 |
| Principle mapping (15 principles) | P0 |
| Cross-domain applications (5 domains) | P0 |
| Semantic search | P0 |
| Mentor chat (RAG) | P0 |
| Video timeline view | P1 |
| Knowledge graph visualization | P1 |
| File upload | P1 |
| User accounts | P2 |
| Multi-mentor support | P3 |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| GPU availability / cost | High | High | Start with CPU; optimize before scaling |
| LLM quality on short clips | Medium | High | Ensemble models; minimum clip length threshold |
| YouTube ToS compliance | Medium | Medium | Respect rate limits; cache results |
| Neo4j performance | Low | Medium | Profile queries early; add indexes proactively |
| Whisper accuracy on Bruce Lee accent | Low | Low | Prompt engineering; manual correction pipeline |

---

*End of Roadmap v1.0*
