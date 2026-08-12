# MentorOS — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2026-05-30  
**Status:** Approved for Development  
**Classification:** Internal — Engineering & Product

---

## 1. Executive Summary

MentorOS is a Human Wisdom Intelligence Platform that converts human expertise captured in video into structured, queryable, cross-domain wisdom. The platform ingests video of masters—starting with Bruce Lee—extracts behavioral patterns, infers underlying principles, and makes that wisdom conversationally accessible and universally applicable.

The core value proposition: **Video → Action → Intent → Principle → Wisdom → Application**

MentorOS does not simply transcribe what people say. It understands what they do, why they do it, and what that reveals about human excellence.

---

## 2. Problem Statement

### The Knowledge Preservation Crisis
The world's greatest wisdom—embodied in the actions, timing, decisions, and movements of masters—exists primarily in video form but cannot be meaningfully searched, learned from, or applied. Watching Bruce Lee is inspiring; understanding *why* he moves that way and how that principle applies to negotiation requires years of dedicated study.

### The Accessibility Gap
Access to master-level wisdom is gated by:
- Time investment (thousands of hours of study)
- Expert interpretation (rare and expensive)
- Contextual translation (domain-specific knowledge to apply lessons cross-domain)

### The Hallucination Problem
Existing AI systems generate responses about masters without grounding in actual source material, producing confident but inaccurate "wisdom."

---

## 3. Solution

MentorOS builds a verified knowledge graph from primary source material (video). Every insight is traceable to a specific timestamp, action, and context. The system:

1. **Extracts** behavioral patterns from video using computer vision
2. **Annotates** actions with intent and context
3. **Maps** actions to underlying principles
4. **Generates** cross-domain wisdom applications
5. **Enables** conversational exploration grounded in evidence

---

## 4. Target Users

### Primary: Knowledge Seekers (B2C)
- Entrepreneurs and business leaders seeking strategic wisdom
- Athletes and coaches studying movement mastery
- Students of philosophy and human excellence
- Content creators and educators

### Secondary: Organizations (B2B)
- Corporate learning & development teams
- Leadership development programs
- Sports analytics organizations
- Educational institutions

### Tertiary: Researchers
- AI/ML researchers studying behavioral understanding
- Psychology and behavioral science researchers
- Biographers and historians

---

## 5. User Stories

### Core Video Analysis
```
As a user, I want to paste a YouTube URL and have the platform 
automatically analyze the video and extract wisdom insights,
so that I can learn from the content without hours of manual study.
```

```
As a user, I want to see a timeline view of the video with 
annotated actions, intents, and principles at each timestamp,
so that I can navigate directly to specific wisdom moments.
```

### Wisdom Exploration
```
As a user, I want to search for "all examples of adaptability"
across all analyzed videos,
so that I can study how a specific principle manifests repeatedly.
```

```
As a user, I want to see how a principle observed in martial arts
applies to business, investing, and leadership,
so that I can apply ancient wisdom to modern challenges.
```

### Mentor Chat
```
As a user, I want to ask "Why did Bruce Lee pause here?" and receive
a grounded, evidence-based answer with timestamp references,
so that I can understand the intent behind specific actions.
```

```
As a user, I want to ask "How does Bruce Lee's concept of flow
apply to product management?",
so that I can apply martial wisdom to my professional life.
```

### Multi-Mentor (Future)
```
As a user, I want to compare how different mentors approach the same
principle (e.g., simplicity as demonstrated by Bruce Lee vs. Warren Buffett),
so that I can gain multi-perspective wisdom.
```

---

## 6. Functional Requirements

### FR-001: Video Ingestion
- Accept YouTube URLs (via yt-dlp)
- Accept direct file uploads (MP4, MOV, AVI, MKV)
- Support videos up to 4 hours in length
- Queue and process asynchronously
- Provide real-time processing status via WebSocket

### FR-002: Audio Processing
- Extract audio from video (FFmpeg)
- Generate accurate transcripts (Whisper large-v3)
- Support multiple languages with English primary
- Produce word-level timestamps
- Detect speaker changes (diarization)

### FR-003: Visual Processing
- Extract keyframes at configurable intervals
- Detect scenes using visual change analysis
- Identify people, objects, and environments
- Analyze body language and facial expressions

### FR-004: Pose & Movement Analysis
- Detect skeletal pose using MediaPipe/YOLO
- Track movement across frames
- Calculate velocity, acceleration, weight distribution
- Identify martial arts techniques and forms

### FR-005: Action Detection
- Classify discrete actions with temporal boundaries
- Map composite action sequences
- Detect action transitions and reactions
- Build action dependency graphs

### FR-006: Intent Analysis
- Infer tactical intent from action sequences
- Analyze contextual signals (opponent behavior, environment)
- Estimate confidence scores for intent inference
- Link intent to outcome when observable

### FR-007: Principle Mapping
- Map actions and intents to the Bruce Lee wisdom taxonomy
- Support multi-principle mapping (actions can demonstrate multiple principles)
- Generate principle strength scores
- Identify principle relationships and hierarchies

### FR-008: Wisdom Generation
- Generate natural language wisdom insights from principle mappings
- Create cross-domain applications (business, investing, leadership, relationships, personal growth)
- Produce quoted evidence from transcript
- Maintain source traceability for all claims

### FR-009: Knowledge Graph Storage
- Store all entities and relationships in Neo4j
- Generate embeddings for semantic search (pgvector)
- Support complex graph traversal queries
- Enable subgraph extraction for specific queries

### FR-010: Search & Discovery
- Semantic search across all wisdom content
- Filter by mentor, principle, domain, confidence
- Full-text search on transcripts
- Graph-based similarity search

### FR-011: Mentor Chat
- Conversational interface for wisdom queries
- RAG-based grounding in source material
- Citation of specific timestamps and clips
- Confidence scores on all responses
- Context-aware conversation history

### FR-012: Timeline View
- Video player with annotation overlay
- Clickable timeline markers for actions/principles
- Principle color-coding and legend
- Export annotations as structured data

### FR-013: User Management
- JWT-based authentication
- Role-based access control (viewer, analyst, admin)
- API key management for programmatic access
- Usage tracking and rate limiting

---

## 7. Non-Functional Requirements

### Performance
- Video processing: complete within 2x video duration
- API response: < 200ms for read operations
- Search: < 500ms for semantic queries
- Chat response: streaming, first token < 1s

### Scale
- Support 10,000 concurrent users (MVP target: 100)
- Process 1,000 videos/day (MVP target: 10)
- Store 1M+ knowledge graph nodes
- Index 100M+ embedding vectors

### Reliability
- 99.9% uptime SLA
- Zero data loss for processed videos
- Graceful degradation for AI service failures
- Automatic retry with exponential backoff

### Security
- All data encrypted at rest (AES-256)
- All communications encrypted in transit (TLS 1.3)
- PII handling compliant with GDPR/CCPA
- Regular penetration testing

### Observability
- Distributed tracing for all AI pipeline steps
- Real-time metrics dashboard
- Alerting on processing failures > 1%
- Full audit log for admin actions

---

## 8. Out of Scope (MVP)

- Real-time video processing (live streams)
- Mobile native apps (web-responsive only)
- Multi-language mentor chat
- Video editing / clip creation
- Social features (sharing, comments)
- Marketplace / mentor submissions

---

## 9. Success Metrics

| Metric | MVP Target | 6-Month Target |
|--------|------------|----------------|
| Videos processed | 100 | 10,000 |
| Wisdom insights generated | 5,000 | 500,000 |
| Knowledge graph nodes | 50,000 | 5,000,000 |
| Active users | 500 | 10,000 |
| Chat sessions | 1,000 | 100,000 |
| Avg. session time | 10 min | 25 min |
| NPS score | > 40 | > 60 |
| Insight accuracy (human eval) | > 75% | > 85% |

---

## 10. Bruce Lee Wisdom Taxonomy

### Tier 1 — Combat Principles (Foundation)
| Principle | Code | Description |
|-----------|------|-------------|
| Adaptability | BL-AD | Formlessness; adjusting to any situation |
| Flow | BL-FL | Water-like movement; continuous natural motion |
| Timing | BL-TM | Perfect moment selection for action |
| Interception | BL-IN | Attacking the attack; meeting force before it arrives |
| Efficiency | BL-EF | Economy of motion; maximum impact, minimum effort |
| Directness | BL-DR | Straight path to the target; no wasted movement |

### Tier 2 — Strategic Principles
| Principle | Code | Description |
|-----------|------|-------------|
| Awareness | BL-AW | Peripheral vision; reading the complete environment |
| Positioning | BL-PO | Strategic placement before action |
| Simplicity | BL-SI | Eliminating the non-essential |
| Non-Resistance | BL-NR | Yielding to redirect force |
| Presence | BL-PR | Complete focus; eliminating mental noise |

### Tier 3 — Philosophical Principles
| Principle | Code | Description |
|-----------|------|-------------|
| Self-Expression | BL-SE | Authentic action; being genuinely oneself |
| Emotional Control | BL-EC | Harnessing emotion without being controlled by it |
| Continuous Growth | BL-CG | Daily self-improvement; absorb what is useful |
| Detachment | BL-DT | Non-attachment to outcomes while committed to process |

### Cross-Domain Mappings (Sample)
```
BL-AD (Adaptability):
  Business:     Pivot strategy; customer-centric iteration
  Investing:    Portfolio rebalancing; thesis updating
  Leadership:   Situational leadership; reading team needs
  Relationships: Meeting people where they are

BL-TM (Timing):
  Business:     Market entry timing; hiring windows
  Investing:    Entry/exit timing; macro cycle awareness
  Leadership:   Delivering feedback at the right moment
  Relationships: Knowing when to speak vs. remain silent
```

---

## 11. Acceptance Criteria

### Video Processing
- [ ] YouTube URL successfully downloads and queues within 30 seconds
- [ ] Processing progress visible in real-time via WebSocket
- [ ] Transcript generated with word-level timestamps
- [ ] Minimum 80% of video scenes correctly segmented
- [ ] Pose keypoints detected for all human subjects visible > 1 second

### Wisdom Generation
- [ ] Every insight includes source timestamp reference
- [ ] Every insight maps to at least one taxonomy principle
- [ ] Cross-domain applications generated for all major principles
- [ ] Confidence score included with every generated insight

### Knowledge Graph
- [ ] All entities stored with correct node types
- [ ] All relationships stored with correct edge types
- [ ] Graph traversal returns correct results for 10 test queries
- [ ] Semantic search returns relevant results for 10 test queries

### Mentor Chat
- [ ] Responses cite specific timestamps from source video
- [ ] Responses acknowledge uncertainty when evidence is weak
- [ ] Response latency < 3 seconds for standard queries
- [ ] Context maintained across 10+ turn conversations

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI model quality insufficient | Medium | High | Ensemble models; human review pipeline |
| YouTube rate limiting | High | Medium | Respect ToS; implement backoff; cache aggressively |
| High compute costs | High | High | GPU optimization; batching; model quantization |
| Hallucination in wisdom generation | High | High | RAG grounding; confidence thresholds; source citations |
| Copyright/IP concerns | Medium | High | Legal review; transformative use; no raw video redistribution |
| Neo4j performance at scale | Low | Medium | Query optimization; indexing; read replicas |

---

*End of PRD v1.0*
