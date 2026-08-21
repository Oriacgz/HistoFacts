# Microservices Architecture — HistoFacts

This document describes the 6 microservice boundaries and decomposition strategy for HistoFacts.

---

## 1. Service Decomposition Overview

HistoFacts is organized into 6 independent services, each with strict domain ownership:

1. **Auth & Identity Service (`:8001`)**
   - User registration, login, JWT token issuance & refresh
   - Username + unique 4-digit tag generation (e.g. `Ryan#3081`)
   - Friend requests & handle search

2. **History Content Service (`:8002`)**
   - Historical events database & vector search
   - Daily background sync job (Wikidata SPARQL / Wikimedia "On This Day" API)
   - User bookmarks

3. **Social Service (`:8003`)**
   - User post creation and public chronicle feed
   - Nested comment threads (via `parent_comment_id` self-referencing hierarchy)
   - Plain like counter

4. **Groups Service (`:8004`)**
   - Group creation, membership roles (`admin`, `member`)
   - Group-scoped discussion feeds

5. **AI Notes Service (`:8005`)**
   - LLM-backed curriculum study note generator
   - Free-text curriculum tag targeting (e.g. NCERT, UPSC)
   - Sharing notes into study groups

6. **Quiz Service (`:8006`)**
   - Topic-based quiz questions
   - Attempt tracking and scoring statistics

---

## 2. API Gateway Routing & Communication

```
Client (React SPA) ──> Nginx API Gateway (:80)
                         ├── /api/auth/*     ──> Auth Service (:8001)
                         ├── /api/events/*   ──> History Service (:8002)
                         ├── /api/social/*   ──> Social Service (:8003)
                         ├── /api/groups/*   ──> Groups Service (:8004)
                         ├── /api/notes/*    ──> AI Notes Service (:8005)
                         └── /api/quiz/*     ──> Quiz Service (:8006)
```

---

## 3. Data Ownership & Event-Driven Async Messaging

- **Database per Service:** Each microservice connects exclusively to its assigned PostgreSQL schema.
- **Async Events via Redis Pub/Sub:**
  - `NOTE_SHARED`: Fired by AI Notes Service when a note is shared to a group -> Groups Service notifies members.
  - `POST_LIKED`: Fired by Social Service -> triggers asynchronous engagement indexing.
