# MentorOS — Database Design

**Version:** 1.0  
**Date:** 2026-05-30

---

## 1. PostgreSQL Schema

### Design Principles
- UUID primary keys for all tables (distribution-safe)
- Audit columns (`created_at`, `updated_at`) on all tables
- Soft deletes via `deleted_at` where appropriate
- pgvector extension for embedding storage
- JSONB for flexible metadata that doesn't require indexing

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer' 
                    CHECK (role IN ('viewer', 'analyst', 'admin')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash        VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MENTORS
-- ============================================================
CREATE TABLE mentors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    birth_year      INTEGER,
    death_year      INTEGER,
    domains         TEXT[] NOT NULL DEFAULT '{}',
    bio             TEXT,
    thumbnail_url   VARCHAR(1000),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mentors (slug, name, birth_year, death_year, domains) VALUES
('bruce-lee', 'Bruce Lee', 1940, 1973, 
 ARRAY['martial-arts', 'philosophy', 'cinema', 'fitness']);

-- ============================================================
-- VIDEOS
-- ============================================================
CREATE TYPE video_source AS ENUM ('youtube', 'upload', 'url');
CREATE TYPE processing_status AS ENUM (
    'QUEUED', 'DOWNLOADING', 'TRANSCRIBING', 'ANALYZING_VISION',
    'DETECTING_ACTIONS', 'GENERATING_WISDOM', 'BUILDING_GRAPH',
    'COMPLETE', 'FAILED', 'CANCELLED'
);

CREATE TABLE videos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id           UUID REFERENCES mentors(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    title               VARCHAR(500),
    description         TEXT,
    source              video_source NOT NULL,
    source_url          VARCHAR(2000),
    source_id           VARCHAR(255),
    storage_path        VARCHAR(1000),
    thumbnail_url       VARCHAR(1000),
    duration_seconds    INTEGER,
    width               INTEGER,
    height              INTEGER,
    fps                 FLOAT,
    language            VARCHAR(10) DEFAULT 'en',
    status              processing_status NOT NULL DEFAULT 'QUEUED',
    processing_started_at   TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_mentor_id ON videos(mentor_id);
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- ============================================================
-- TRANSCRIPTS
-- ============================================================
CREATE TABLE transcripts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id        UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    language        VARCHAR(10) NOT NULL DEFAULT 'en',
    full_text       TEXT NOT NULL,
    word_count      INTEGER,
    confidence      FLOAT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(video_id, language)
);

CREATE TABLE transcript_segments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id   UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    start_time      FLOAT NOT NULL,
    end_time        FLOAT NOT NULL,
    text            TEXT NOT NULL,
    speaker_id      VARCHAR(50),
    confidence      FLOAT,
    words           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcript_segments_transcript_id ON transcript_segments(transcript_id);
CREATE INDEX idx_transcript_segments_time ON transcript_segments(start_time, end_time);

-- ============================================================
-- SCENES
-- ============================================================
CREATE TABLE scenes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    scene_index         INTEGER NOT NULL,
    start_time          FLOAT NOT NULL,
    end_time            FLOAT NOT NULL,
    duration            FLOAT GENERATED ALWAYS AS (end_time - start_time) STORED,
    keyframe_path       VARCHAR(1000),
    scene_type          VARCHAR(100),
    environment         VARCHAR(100),
    people_count        INTEGER DEFAULT 0,
    dominant_colors     JSONB,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(video_id, scene_index)
);

CREATE INDEX idx_scenes_video_id ON scenes(video_id);
CREATE INDEX idx_scenes_time ON scenes(start_time, end_time);

-- ============================================================
-- POSE DATA
-- ============================================================
CREATE TABLE pose_frames (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id        UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    timestamp       FLOAT NOT NULL,
    person_index    INTEGER NOT NULL DEFAULT 0,
    keypoints       JSONB NOT NULL,
    confidence      FLOAT,
    bbox            JSONB,
    velocity        JSONB,
    acceleration    JSONB
);

CREATE INDEX idx_pose_frames_scene_id ON pose_frames(scene_id);
CREATE INDEX idx_pose_frames_timestamp ON pose_frames(timestamp);

-- ============================================================
-- ACTIONS
-- ============================================================
CREATE TABLE wisdom_principles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id       UUID NOT NULL REFERENCES mentors(id),
    code            VARCHAR(10) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    tier            INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    description     TEXT NOT NULL,
    definition      TEXT NOT NULL,
    related_codes   TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detected_actions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id            UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    action_type         VARCHAR(200) NOT NULL,
    action_subtype      VARCHAR(200),
    start_time          FLOAT NOT NULL,
    end_time            FLOAT NOT NULL,
    confidence          FLOAT NOT NULL,
    intensity           FLOAT,
    pose_analysis       JSONB,
    context_notes       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_detected_actions_scene_id ON detected_actions(scene_id);
CREATE INDEX idx_detected_actions_video_id ON detected_actions(video_id);
CREATE INDEX idx_detected_actions_time ON detected_actions(start_time, end_time);

-- ============================================================
-- WISDOM INSIGHTS
-- ============================================================
CREATE TABLE wisdom_insights (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id            UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    scene_id            UUID REFERENCES scenes(id),
    action_id           UUID REFERENCES detected_actions(id),
    mentor_id           UUID NOT NULL REFERENCES mentors(id),
    title               VARCHAR(500) NOT NULL,
    insight_text        TEXT NOT NULL,
    evidence_quote      TEXT,
    start_time          FLOAT,
    end_time            FLOAT,
    confidence_score    FLOAT NOT NULL DEFAULT 0.0,
    model_version       VARCHAR(100),
    graph_node_id       VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE insight_principles (
    insight_id          UUID NOT NULL REFERENCES wisdom_insights(id) ON DELETE CASCADE,
    principle_id        UUID NOT NULL REFERENCES wisdom_principles(id),
    relevance_score     FLOAT NOT NULL DEFAULT 1.0,
    PRIMARY KEY (insight_id, principle_id)
);

CREATE TABLE insight_applications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_id          UUID NOT NULL REFERENCES wisdom_insights(id) ON DELETE CASCADE,
    domain              VARCHAR(50) NOT NULL 
                        CHECK (domain IN ('business', 'investing', 'leadership', 
                                         'relationships', 'personal_growth', 'athletics')),
    application_text    TEXT NOT NULL,
    example             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wisdom_insights_video_id ON wisdom_insights(video_id);
CREATE INDEX idx_wisdom_insights_mentor_id ON wisdom_insights(mentor_id);
CREATE INDEX idx_wisdom_insights_time ON wisdom_insights(start_time, end_time);

-- ============================================================
-- VECTOR EMBEDDINGS
-- ============================================================
CREATE TABLE embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     VARCHAR(50) NOT NULL 
                    CHECK (entity_type IN ('insight', 'transcript_segment', 
                                          'principle', 'application')),
    entity_id       UUID NOT NULL,
    model           VARCHAR(100) NOT NULL DEFAULT 'bge-m3',
    embedding       vector(1024) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
CREATE TABLE chat_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id       UUID REFERENCES mentors(id),
    video_id        UUID REFERENCES videos(id),
    title           VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    citations       JSONB DEFAULT '[]',
    confidence      FLOAT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================
-- PROCESSING JOBS
-- ============================================================
CREATE TABLE processing_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id        UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    job_type        VARCHAR(100) NOT NULL,
    celery_task_id  VARCHAR(255),
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress        FLOAT DEFAULT 0.0,
    result          JSONB,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_video_id ON processing_jobs(video_id);
CREATE INDEX idx_processing_jobs_celery_id ON processing_jobs(celery_task_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(200) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================
-- SEED: WISDOM PRINCIPLES
-- ============================================================
INSERT INTO wisdom_principles (mentor_id, code, name, tier, description, definition) 
SELECT 
    m.id,
    v.code,
    v.name,
    v.tier,
    v.description,
    v.definition
FROM mentors m
CROSS JOIN (VALUES
    ('BL-AD', 'Adaptability', 1, 'Formlessness; adjusting to any situation', 
     'The ability to change form, approach, or strategy to match the demands of any situation, without attachment to a fixed method.'),
    ('BL-FL', 'Flow', 1, 'Water-like movement; continuous natural motion',
     'Movement and action that is effortless, continuous, and natural, following the path of least resistance while maintaining power.'),
    ('BL-TM', 'Timing', 1, 'Perfect moment selection for action',
     'The mastery of selecting the precise moment to act, move, or speak for maximum effect.'),
    ('BL-IN', 'Interception', 1, 'Attacking the attack; meeting force before it arrives',
     'The principle of addressing threats at their source, intercepting actions before they fully develop.'),
    ('BL-EF', 'Efficiency', 1, 'Economy of motion; maximum impact with minimum effort',
     'Eliminating all unnecessary expenditure of energy while maximizing the effectiveness of each action.'),
    ('BL-DR', 'Directness', 1, 'Straight path to the target; no wasted movement',
     'Taking the most direct route to an objective without detours, distractions, or unnecessary complexity.'),
    ('BL-AW', 'Awareness', 2, 'Peripheral vision; reading the complete environment',
     'Maintaining full situational awareness of the environment, people, and context without fixating on single points.'),
    ('BL-PO', 'Positioning', 2, 'Strategic placement before action',
     'Establishing advantageous position before initiating action, ensuring structural superiority.'),
    ('BL-SI', 'Simplicity', 2, 'Eliminating the non-essential',
     'Reducing to core essence by removing everything that does not directly serve the purpose.'),
    ('BL-NR', 'Non-Resistance', 2, 'Yielding to redirect force',
     'Rather than meeting force with force, yielding and redirecting opposing energy to one''s advantage.'),
    ('BL-PR', 'Presence', 2, 'Complete focus; eliminating mental noise',
     'Total engagement with the present moment, free from distraction, doubt, or anticipation.'),
    ('BL-SE', 'Self-Expression', 3, 'Authentic action; being genuinely oneself',
     'Acting from authentic self rather than imitation; expressing one''s unique qualities without artifice.'),
    ('BL-EC', 'Emotional Control', 3, 'Harnessing emotion without being controlled by it',
     'Channeling emotional energy productively while maintaining rational decision-making capacity.'),
    ('BL-CG', 'Continuous Growth', 3, 'Daily self-improvement; absorb what is useful',
     'The commitment to daily improvement, willingness to absorb useful knowledge from any source.'),
    ('BL-DT', 'Detachment', 3, 'Non-attachment to outcomes while committed to process',
     'Giving full effort to process while releasing attachment to specific outcomes.')
) AS v(code, name, tier, description, definition)
WHERE m.slug = 'bruce-lee';
```

---

## 2. Indexing Strategy

### Text Search Indexes
```sql
-- Full-text search on transcripts
CREATE INDEX idx_transcript_segments_fts ON transcript_segments 
USING GIN (to_tsvector('english', text));

-- Full-text search on wisdom insights
CREATE INDEX idx_wisdom_insights_fts ON wisdom_insights
USING GIN (to_tsvector('english', title || ' ' || insight_text));

-- Trigram similarity for fuzzy matching
CREATE INDEX idx_wisdom_insights_trgm ON wisdom_insights
USING GIN (title gin_trgm_ops);
```

### Vector Search Configuration
```sql
-- IVFFlat index for approximate nearest neighbor
-- lists parameter: sqrt(total_rows) is recommended
-- For 1M embeddings, use lists=1000
CREATE INDEX idx_embeddings_ivfflat ON embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);

-- For < 100K embeddings, HNSW is more accurate
CREATE INDEX idx_embeddings_hnsw ON embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 3. Redis Schema

### Queue Keys
```
mentorios:queue:video.download      # Video download jobs
mentorios:queue:video.process       # Video processing jobs  
mentorios:queue:wisdom.generate     # Wisdom generation jobs
mentorios:queue:embed.generate      # Embedding generation jobs
```

### Cache Keys
```
mentorios:cache:video:{video_id}              # Video metadata (TTL: 1h)
mentorios:cache:insights:{video_id}           # Video insights (TTL: 24h)
mentorios:cache:principles                    # All principles (TTL: 24h)
mentorios:cache:search:{query_hash}           # Search results (TTL: 15m)
mentorios:cache:chat:{session_id}             # Chat history (TTL: 2h)
```

### Processing State
```
mentorios:job:{job_id}:status        # Job status
mentorios:job:{job_id}:progress      # Job progress (0-100)
mentorios:job:{job_id}:step          # Current pipeline step
```

### Rate Limiting
```
mentorios:ratelimit:{user_id}:{window}    # Request count in window
mentorios:ratelimit:ip:{ip}:{window}     # IP-based limit
```

---

## 4. Migration Strategy

- All migrations managed by **Alembic**
- Each migration is atomic and reversible
- Naming convention: `YYYYMMDD_HHMM_description.py`
- Always run in transaction
- Test down migration in CI before merging

---

*End of Database Design v1.0*
