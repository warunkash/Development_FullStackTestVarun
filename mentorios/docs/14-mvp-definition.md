# MentorOS — MVP Definition & Cost Estimate

**Version:** 1.0  
**Date:** 2026-05-30

---

## MVP Definition

### What Makes the Cut

The MentorOS MVP demonstrates the complete **Video → Wisdom → Chat** loop with:

1. **One mentor** (Bruce Lee) — complete taxonomy
2. **One analysis path** — YouTube URL ingestion
3. **Full AI pipeline** — download, transcribe, detect, extract, store
4. **Basic wisdom explorer** — search, filter by principle, view applications
5. **Mentor chat** — RAG-grounded, streaming responses with citations
6. **Timeline view** — annotated video timeline with wisdom markers

### What Doesn't Make the Cut

- File upload (P1 — add in sprint 2)
- Multiple mentors (P3 — architecture supports it)
- Graph visualization (P1 — add in sprint 4)
- User authentication (P2 — add in sprint 3)
- Mobile native apps (out of scope)
- Real-time video (out of scope)
- Social features (out of scope)

### MVP Success Criteria

- Process 10 Bruce Lee videos end-to-end
- Extract minimum 50 wisdom insights per video
- Achieve > 75% principle accuracy (human eval)
- Chat responses grounded in evidence for 90% of queries
- Processing time < 2× video duration
- API response time < 200ms (read), < 1s (search)

---

## Infrastructure Cost Estimate

### Development Environment (Monthly)

| Resource | Config | Cost/Month |
|----------|--------|-----------|
| Developer workstation GPU | RTX 4090 (24GB) | $0 (owned) |
| Cloud GPU (vLLM testing) | 1× A100 40GB on demand | ~$200 |
| PostgreSQL (dev) | Docker local | $0 |
| Total Dev | | ~$200/month |

### MVP Production (100 users, 10 videos/day)

| Resource | Config | Cost/Month |
|----------|--------|-----------|
| API servers | 2× c3-standard-8 (Google Cloud) | $280 |
| Video workers | 1× g2-standard-8 (L4 GPU) | $400 |
| Wisdom worker | 1× a2-highgpu-4g (4×A100) | $2,400 |
| PostgreSQL | Cloud SQL PostgreSQL 16, 4vCPU 16GB | $180 |
| Redis | Memorystore, 5GB | $80 |
| Neo4j | Self-hosted on e2-standard-4 | $120 |
| MinIO storage | GCS equivalent, 1TB | $20 |
| Load balancer | Cloud Load Balancing | $20 |
| Networking | Egress 100GB | $10 |
| Monitoring | Cloud Monitoring + Grafana Cloud | $50 |
| **MVP Total** | | **~$3,560/month** |

### Scale Production (10,000 users, 1,000 videos/day)

| Resource | Config | Cost/Month |
|----------|--------|-----------|
| API servers | 5× c3-standard-16 (auto-scaled) | $1,400 |
| Video workers | 8× g2-standard-16 (L4 GPU) | $3,200 |
| vLLM cluster | 4× a2-highgpu-8g (8×A100 each) | $19,200 |
| PostgreSQL | Cloud SQL HA, 16vCPU 64GB + 2 replicas | $1,200 |
| Redis | Memorystore 50GB cluster | $400 |
| Neo4j | 3-node cluster, 16vCPU each | $1,400 |
| Storage | GCS 10TB | $200 |
| CDN | Cloud CDN for video thumbnails | $100 |
| Monitoring | Full observability stack | $200 |
| **Scale Total** | | **~$27,300/month** |

### Cost Optimization Strategies

1. **Model quantization**: AWQ 4-bit reduces A100 count by 2×
2. **Spot/preemptible instances**: 60-80% discount on worker VMs
3. **Batched processing**: Queue videos and process in batches during off-peak
4. **Model distillation**: Train 7B model on 72B outputs for routine principle mapping
5. **Caching**: Cache embeddings + common queries → 40-60% reduction in LLM calls
6. **Reserved capacity**: 1-year commitment saves 30-40% on stable capacity

---

## Technical Debt Acknowledgment

The MVP makes these intentional shortcuts:

1. **Auth skipped initially**: Auth layer commented out in routers (add in Phase 2)
2. **Simplified action detection**: Heuristic-based for MVP; MMAction2 integration in Phase 3
3. **Single mentor**: Schema supports multi-mentor; Bruce Lee taxonomy is the seed
4. **No fine-tuning**: Using base Qwen2.5 models; fine-tuning is Phase 5+
5. **No graph visualization**: Neo4j data model is complete; UI in Phase 4

---

## Go-to-Market

### Beta Launch (Month 2)
- 100 invite-only users
- Bruce Lee video library (50 videos)
- Wisdom explorer + chat only
- Free (gather feedback)

### Public Launch (Month 4)
- 1,000 user waitlist
- Freemium: 5 video analyses/month free
- Pro: $29/month — unlimited analyses + API access
- Team: $99/month — shared workspace

### Revenue Model
- B2C: $29-99/month subscriptions
- B2B: $500-2000/month for team/enterprise
- API: Usage-based pricing for developers
- Data/research licensing (aggregate wisdom data)

---

*End of MVP Definition v1.0*
