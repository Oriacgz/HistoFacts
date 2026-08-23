# Microservices Architecture — HistoFacts

This document describes the 6 independent microservices, API Gateway routing, and containerization for HistoFacts.

---

## 1. Service Decomposition & Port Allocation

HistoFacts is organized into 6 independent services, each with strict domain ownership:

```
                               ┌────────────────────────┐
                               │ React Frontend (SPA)   │
                               └───────────┬────────────┘
                                           │ http://localhost:8000/api/*
                                           ▼
                               ┌────────────────────────┐
                               │   Nginx API Gateway    │
                               │  (or FastAPI Gateway)  │
                               └───────────┬────────────┘
         ┌──────────────┬──────────────┬───┴──────────┬──────────────┬──────────────┐
         │              │              │              │              │              │
         ▼ :8001        ▼ :8002        ▼ :8003        ▼ :8004        ▼ :8005        ▼ :8006
  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
  │   Auth     │ │  History   │ │   Social   │ │   Groups   │ │  AI Notes  │ │    Quiz    │
  │  Service   │ │  Service   │ │  Service   │ │  Service   │ │  Service   │ │  Service   │
  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
        │              │              │              │              │              │
        └──────────────┴──────────────┼──────────────┴──────────────┴──────────────┘
                                      ▼
                        ┌────────────────────────┐
                        │   PostgreSQL Engine    │
                        │ (Isolated Domain Data) │
                        └────────────────────────┘
```

| Service | Port | Entrypoint | Routes Handled | Description |
|---|---|---|---|---|
| **1. Auth & Identity** | `:8001` | `app.auth.main:app` | `/api/auth/*` | Registration, login, JWT token issuance & refresh, unique 4-digit `#tag` generator, user search |
| **2. History Content** | `:8002` | `app.history.main:app` | `/api/events/*` | Historical events database, today's facts feed, calendar date browser, keyword search, bookmarks, Wikimedia sync |
| **3. Social Discussion** | `:8003` | `app.social.main:app` | `/api/social/*` | Public Chronicle feed, threaded hierarchical comments (`parent_comment_id`), deduplicated like counter |
| **4. Groups Service** | `:8004` | `app.groups.main:app` | `/api/groups/*` | Group creation, membership roles (`admin`/`member`), group-scoped discussion feeds |
| **5. AI Notes & Economy** | `:8005` | `app.ai_notes.main:app` | `/api/notes/*`<br>`/api/wallet/*`<br>`/api/shop/*` | Curriculum study note synthesis, handwritten notes conversion, token quota wallet, Histoins token pack shop |
| **6. Quiz & Assessment** | `:8006` | `app.quiz.main:app` | `/api/quiz/*` | Historical question bank, attempt evaluation, accuracy scoring, and Histoin rewards (+20 Histoins) |

---

## 2. API Gateway Routing

The React frontend sends all API requests to the unified Gateway endpoint (`http://localhost:8000/api/*`). The Gateway proxies requests to the downstream microservices:

| Path Prefix | Destination Microservice |
|---|---|
| `/api/auth/*` | `http://auth-service:8001/api/auth/*` |
| `/api/events/*` | `http://history-service:8002/api/events/*` |
| `/api/social/*` | `http://social-service:8003/api/social/*` |
| `/api/groups/*` | `http://groups-service:8004/api/groups/*` |
| `/api/notes/*` | `http://notes-service:8005/api/notes/*` |
| `/api/wallet/*` | `http://notes-service:8005/api/wallet/*` |
| `/api/shop/*` | `http://notes-service:8005/api/shop/*` |
| `/api/quiz/*` | `http://quiz-service:8006/api/quiz/*` |
| `/health` | Gateway health check pinging all 6 services |

---

## 3. How to Run

### Option A: Local Multi-Service Runner (Recommended for Dev)
Run all 6 microservices + the development API Gateway concurrently with live logs using a single command:

```bash
cd backend
python run_microservices.py
```

### Option B: Docker Compose (Production / Containerized)
Build and spin up all 6 microservices, PostgreSQL, and the Nginx API Gateway:

```bash
docker compose up --build
```
