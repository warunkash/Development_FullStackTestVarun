# Graph Report - Development_FullStackTestVarun  (2026-05-30)

## Corpus Check
- 33 files · ~3,189,378 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 105 nodes · 103 edges · 23 communities (11 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17ee59ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]

## God Nodes (most connected - your core abstractions)
1. `Controller_API` - 12 edges
2. `ORM` - 9 edges
3. `ORM` - 8 edges
4. `Database_PDO` - 5 edges
5. `Database_Result` - 4 edges
6. `Database_Result_Cached` - 4 edges
7. `Full-Stack Developer Test` - 4 edges
8. `Request` - 3 edges
9. `Response` - 3 edges
10. `errorToExceptionHandler()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `ORM` --implements--> `JsonSerializable`  [EXTRACTED]
  assignment/php/classes/ORM.php →   _Bridges community 4 → community 2_

## Communities (23 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (9): Model_Booker, Model_Booking, Model_BookingItem, Model_Item, Model_Product, Model_Space, Model_User, Model_Venue (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.30
Nodes (4): ORM, Controller, Model_Booking, Controller_API

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (5): Database_Result, JsonSerializable, Kohana_Database_Result, Kohana_Database_Result_Cached, Database_Result_Cached

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (8): Bookers, Booking_Items, Bookings, Items, Products, Spaces, Users, Venues

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (4): Assignment 1: Build a REST API with Django, Assignment 2: Add a Front-End to your Django application, Full-Stack Developer Test, Notes:

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (4): Exception, errorToExceptionHandler(), fatalErrorHandler(), uncaughtExceptionHandler()

## Knowledge Gaps
- **17 isolated node(s):** `Model_Booking`, `Exception`, `Venues`, `Items`, `Spaces` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ORM` connect `Community 4` to `Community 2`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Model_Booking`, `Exception`, `Venues` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._