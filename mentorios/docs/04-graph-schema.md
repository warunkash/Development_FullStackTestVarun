# MentorOS — Knowledge Graph Schema (Neo4j)

**Version:** 1.0  
**Date:** 2026-05-30

---

## 1. Graph Design Philosophy

The MentorOS knowledge graph represents the **semantic web of wisdom** — connecting observable actions to underlying principles to cross-domain applications. Unlike relational databases that optimize for structured queries, the graph excels at:

- Traversing principle relationships across different contexts
- Finding analogous patterns across mentors
- Discovering unexpected connections between principles
- Enabling "wisdom path" queries

---

## 2. Node Types

### 2.1 `:Mentor`
Represents a master whose wisdom is captured in the system.

```cypher
(:Mentor {
  id: String,           // UUID from PostgreSQL
  slug: String,         // "bruce-lee" (unique, used in URLs)
  name: String,         // "Bruce Lee"
  era: String,          // "Modern", "Classical", "Ancient"
  domains: [String],    // ["martial-arts", "philosophy", "cinema"]
  birth_year: Integer,
  death_year: Integer
})
```

### 2.2 `:Video`
A processed video containing wisdom content.

```cypher
(:Video {
  id: String,           // UUID from PostgreSQL
  title: String,
  source_url: String,
  duration: Float,      // seconds
  processed_at: DateTime,
  quality_score: Float  // 0-1 quality assessment
})
```

### 2.3 `:Scene`
A discrete temporal segment within a video.

```cypher
(:Scene {
  id: String,
  video_id: String,
  scene_index: Integer,
  start_time: Float,
  end_time: Float,
  scene_type: String,   // "interview", "demonstration", "sparring", "film"
  environment: String   // "gym", "studio", "street", "ring"
})
```

### 2.4 `:Action`
An observable action performed by the mentor.

```cypher
(:Action {
  id: String,
  action_type: String,        // "punch", "sidestep", "speak", "pause"
  action_subtype: String,     // "jab", "cross", "hook" for punches
  start_time: Float,
  end_time: Float,
  intensity: Float,           // 0-1
  velocity: Float,            // pixels/second (for movement)
  confidence: Float,          // AI detection confidence
  description: String         // Human-readable description
})
```

### 2.5 `:Intent`
The inferred tactical or strategic intent behind an action.

```cypher
(:Intent {
  id: String,
  intent_type: String,        // "defensive", "offensive", "teaching", "probing"
  description: String,        // "Setting up opponent for counter"
  confidence: Float,          // 0-1 confidence of inference
  evidence: String            // Reasoning for inference
})
```

### 2.6 `:Principle`
A Bruce Lee wisdom principle (from the taxonomy).

```cypher
(:Principle {
  id: String,
  code: String,           // "BL-AD"
  name: String,           // "Adaptability"
  tier: Integer,          // 1, 2, or 3
  description: String,
  definition: String,
  mentor_id: String
})
```

### 2.7 `:Lesson`
A specific lesson extracted from one or more actions/scenes.

```cypher
(:Lesson {
  id: String,
  title: String,
  text: String,           // The wisdom insight text
  evidence_quote: String, // Direct quote from transcript
  start_time: Float,      // Video timestamp reference
  confidence: Float,
  model_version: String
})
```

### 2.8 `:Application`
A cross-domain application of a lesson.

```cypher
(:Application {
  id: String,
  domain: String,         // "business", "investing", "leadership"
  title: String,
  text: String,
  example: String,        // Concrete example
  actionable_steps: [String]
})
```

### 2.9 `:Concept`
An abstract concept referenced across multiple principles or lessons.

```cypher
(:Concept {
  id: String,
  name: String,           // "wu wei", "mushin", "flow state"
  description: String,
  tradition: String       // "Taoism", "Zen", "Physics"
})
```

### 2.10 `:Outcome`
An observable result or consequence referenced in wisdom content.

```cypher
(:Outcome {
  id: String,
  outcome_type: String,   // "victory", "failure", "insight", "transformation"
  description: String,
  context: String
})
```

---

## 3. Relationship Types

### 3.1 Structural Relationships

```cypher
// Mentor → Video
(:Mentor)-[:APPEARS_IN {
  role: String    // "subject", "teacher", "opponent"
}]->(:Video)

// Video → Scene
(:Video)-[:CONTAINS {
  scene_count: Integer
}]->(:Scene)

// Scene → Action
(:Scene)-[:INCLUDES {
  action_count: Integer
}]->(:Action)

// Action → Intent
(:Action)-[:REVEALS {
  confidence: Float
}]->(:Intent)
```

### 3.2 Wisdom Relationships

```cypher
// Action → Principle
(:Action)-[:DEMONSTRATES {
  relevance_score: Float,   // 0-1
  context: String
}]->(:Principle)

// Intent → Principle
(:Intent)-[:EXEMPLIFIES {
  strength: Float
}]->(:Principle)

// Scene → Lesson
(:Scene)-[:TEACHES {
  confidence: Float
}]->(:Lesson)

// Lesson → Principle
(:Lesson)-[:GROUNDED_IN {
  primary: Boolean          // Is this the primary principle?
}]->(:Principle)

// Lesson → Application
(:Lesson)-[:APPLIES_TO {
  domain: String,
  relevance: Float
}]->(:Application)
```

### 3.3 Semantic Relationships

```cypher
// Principle → Principle
(:Principle)-[:SUPPORTS {
  description: String       // How they support each other
}]->(:Principle)

(:Principle)-[:CONTRADICTS {
  context: String           // Under what conditions they conflict
}]->(:Principle)

(:Principle)-[:RELATES_TO {
  relationship_type: String,
  strength: Float
}]->(:Principle)

// Principle → Concept
(:Principle)-[:GROUNDED_IN]->(:Concept)

// Action → Outcome
(:Action)-[:LEADS_TO {
  confidence: Float
}]->(:Outcome)

// Lesson → Concept
(:Lesson)-[:REFERENCES]->(:Concept)
```

### 3.4 Cross-Mentor Relationships (Future)

```cypher
// Principle equivalence across mentors
(:Principle {mentor: "bruce-lee"})-[:PARALLELS {
  similarity_score: Float,
  explanation: String
}]->(:Principle {mentor: "musashi"})

// Concept shared across mentors
(:Mentor)-[:EMBODIES]->(:Concept)
```

---

## 4. Cypher Query Examples

### 4.1 Find all demonstrations of Adaptability
```cypher
MATCH (v:Video)<-[:APPEARS_IN]-(m:Mentor {slug: 'bruce-lee'})
MATCH (v)-[:CONTAINS]->(s:Scene)-[:INCLUDES]->(a:Action)
MATCH (a)-[:DEMONSTRATES]->(p:Principle {code: 'BL-AD'})
RETURN s.start_time, s.end_time, a.action_type, a.description, a.confidence
ORDER BY a.confidence DESC
LIMIT 20
```

### 4.2 Full wisdom path for a timestamp
```cypher
MATCH (v:Video {id: $video_id})-[:CONTAINS]->(s:Scene)
WHERE s.start_time <= $timestamp <= s.end_time
MATCH (s)-[:INCLUDES]->(a:Action)-[:REVEALS]->(i:Intent)
MATCH (a)-[:DEMONSTRATES]->(p:Principle)
MATCH (s)-[:TEACHES]->(l:Lesson)-[:APPLIES_TO]->(app:Application)
RETURN s, a, i, p, l, app
```

### 4.3 Cross-domain applications for business
```cypher
MATCH (l:Lesson)-[:APPLIES_TO]->(app:Application {domain: 'business'})
MATCH (l)-[:GROUNDED_IN]->(p:Principle)
MATCH (s:Scene)-[:TEACHES]->(l)
MATCH (v:Video)-[:CONTAINS]->(s)
RETURN p.name, l.title, app.text, v.title, s.start_time
ORDER BY p.tier ASC, l.confidence DESC
LIMIT 50
```

### 4.4 Find principle clusters (related principles)
```cypher
MATCH (p1:Principle)-[r:SUPPORTS|RELATES_TO]-(p2:Principle)
WHERE p1.code = 'BL-FL'
RETURN p1, r, p2
```

### 4.5 Wisdom similarity search (vector-enhanced)
```cypher
// Combine with pgvector for hybrid search
MATCH (l:Lesson)-[:GROUNDED_IN]->(p:Principle)
MATCH (v:Video)-[:CONTAINS]->(s:Scene)-[:TEACHES]->(l)
WHERE l.id IN $similar_lesson_ids  // From pgvector search
RETURN l, p, s.start_time, v.title
ORDER BY l.confidence DESC
```

### 4.6 Principle frequency analysis
```cypher
MATCH (m:Mentor {slug: 'bruce-lee'})-[:APPEARS_IN]->(v:Video)
MATCH (v)-[:CONTAINS]->(:Scene)-[:INCLUDES]->(a:Action)
MATCH (a)-[:DEMONSTRATES]->(p:Principle)
RETURN p.name, p.code, count(a) as frequency
ORDER BY frequency DESC
```

---

## 5. Graph Constraints & Indexes

```cypher
// Uniqueness constraints
CREATE CONSTRAINT mentor_slug_unique FOR (m:Mentor) REQUIRE m.slug IS UNIQUE;
CREATE CONSTRAINT video_id_unique FOR (v:Video) REQUIRE v.id IS UNIQUE;
CREATE CONSTRAINT scene_id_unique FOR (s:Scene) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT action_id_unique FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT principle_code_unique FOR (p:Principle) REQUIRE p.code IS UNIQUE;
CREATE CONSTRAINT lesson_id_unique FOR (l:Lesson) REQUIRE l.id IS UNIQUE;
CREATE CONSTRAINT application_id_unique FOR (app:Application) REQUIRE app.id IS UNIQUE;

// Performance indexes
CREATE INDEX video_mentor_idx FOR (v:Video) ON (v.mentor_id);
CREATE INDEX scene_time_idx FOR (s:Scene) ON (s.start_time, s.end_time);
CREATE INDEX action_type_idx FOR (a:Action) ON (a.action_type);
CREATE INDEX principle_tier_idx FOR (p:Principle) ON (p.tier);
CREATE INDEX lesson_confidence_idx FOR (l:Lesson) ON (l.confidence);
CREATE INDEX application_domain_idx FOR (app:Application) ON (app.domain);

// Full-text indexes
CREATE FULLTEXT INDEX lesson_text_idx FOR (l:Lesson) ON EACH [l.title, l.text];
CREATE FULLTEXT INDEX application_text_idx FOR (app:Application) ON EACH [app.title, app.text];
```

---

## 6. Graph Evolution Strategy

### Adding New Mentors
1. Create `:Mentor` node
2. Define mentor-specific principle taxonomy
3. Map principles to `:Concept` nodes (shared across mentors)
4. Create `:PARALLELS` relationships to existing principles

### Adding New Domains
1. Extend `domain` enum in `:Application` nodes
2. Generate applications for existing lessons
3. Update cross-domain mapping prompts

### Schema Versioning
- Neo4j schema version tracked in application config
- Migration scripts in `infrastructure/neo4j/migrations/`
- Rollback procedures documented for each migration

---

*End of Graph Schema v1.0*
