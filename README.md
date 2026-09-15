# HistoFacts 🏛️

> **AI-powered historical education platform** — multiplayer quizzes, AI-generated study notes, a social history feed, and a token economy — all in one.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-32%20passing%20%7C%201%20skipped-brightgreen)](#testing)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-11%2F11%20passing-brightgreen)](#testing)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#testing)

---

## 📖 Table of Contents

1. [Product Overview](#product-overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Local Development Setup](#local-development-setup)
7. [Environment Variables](#environment-variables)
8. [Database Migrations](#database-migrations)
9. [Testing](#testing)
10. [Docker Compose Deployment](#docker-compose-deployment)
11. [WebSocket Multiplayer Lobby](#websocket-multiplayer-lobby)
12. [Security Architecture](#security-architecture)
13. [Troubleshooting](#troubleshooting)

---

## Product Overview

HistoFacts is a full-stack SPA built for history enthusiasts, students, and competitive exam aspirants. It combines:

- **On-this-day history feed** synced from Wikimedia
- **AI-powered personalized quizzes** from topic or uploaded PDF
- **Kahoot-style real-time multiplayer quiz lobbies** (WebSocket)
- **AI study notes** with token economy (LLM-powered)
- **Social discussion feed** (posts, comments, likes)
- **Study groups** with shared notes
- **Friends system** and global leaderboard
- **Histoins reward economy** earned by quiz participation

---

## Features

| Feature | Description |
|---|---|
| 📅 Today in History | Date-specific events from Wikimedia with full search |
| 🧠 Personalized Quiz | AI-generates questions from any topic or uploaded document |
| 🎮 Multiplayer Lobby | Kahoot-style real-time quiz rooms with JWT-authenticated host control |
| 📝 AI Notes | LLM-generated structured notes with curriculum tagging |
| 🪙 Token Economy | AI usage costs tokens; Histoins earned by quiz, spent at shop |
| 💬 Social Feed | Posts, threaded comments, likes with event context |
| 👥 Study Groups | Create groups, share notes, group-scoped posts |
| 🤝 Friends | Add/remove friends, see their activity |
| 🏆 Leaderboard | Monthly global quiz leaderboard with accuracy and score ranking |
| 🔖 Bookmarks | Save historical events for later |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser (React SPA)                           │
│     React 19 + Vite · Code-Split Lazy Routes · WebSocket Client         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Direct HTTP (CORS) / WebSocket
┌────────────────────────────────────▼────────────────────────────────────┐
│                    API Gateway / Reverse Proxy (port 8000)              │
│       Nginx (Docker) · WebSocket Upgrade · /internal route isolation    │
│       OR FastAPI Gateway (Python) — microservice URL resolver           │
└─────────┬─────────────────────────────────────────────────┬─────────────┘
          │ HTTP Proxy                                      │ WS Proxy
          │                                                 │
┌─────────▼─────────────────────────────────────────────────▼─────────────┐
│                             FastAPI Backend                             │
│       Modular Monolith mode (default) OR Microservices mode (Docker)    │
│                                                                         │
│  ┌──────────────┐   ┌───────────────────────────┐   ┌────────────────┐  │
│  │  Auth        │   │  History Content          │   │  Quiz & WS     │  │
│  │  :8001       │   │  :8002 (Wikimedia + Groq) │   │  :8006         │  │
│  └──────────────┘   └─────────────┬─────────────┘   └────────────────┘  │
│  ┌──────────────┐   ┌─────────────│─────────────┐   ┌────────────────┐  │
│  │  Social Feed │   │  Study Groups             │   │  AI Notes +    │  │
│  │  :8003       │   │  :8004                    │   │  Wallet :8005  │  │
│  └──────────────┘   └───────────────────────────┘   └────────────────┘  │
│  ┌──────────────┐                                                       │
│  │ Notifications│                                                       │
│  │ :8007        │                                                       │
│  └──────────────┘                                                       │
└────────────────────────────────────┬──────┬─────────────────────────────┘
                                     │      │ asyncpg
                                     │      ▼
                                     │   ┌────────────────────────────────┐
                                     │   │      PostgreSQL Database       │
                                     │   │   20 Tables · Alembic Async    │
                                     │   └────────────────────────────────┘
                                     │
               ┌─────────────────────┴────────────────────────┐
               │         External Data & AI Enrichment        │
               ▼                                              ▼
    ┌───────────────────────────┐              ┌──────────────────────────┐
    │    Wikimedia Feed API     │              │    Groq AI Cloud API     │
    │  (On This Day - 5 Feeds)  │              │ (allam-2-7b AI Hooks)    │
    │  • Selected  • Events     │              │  • HTTP Keep-Alive Pool  │
    │  • Births    • Deaths     │              │  • "Did you know that...?"
    │  • Holidays               │              │  • Rate-Limit Protected  │
    └───────────────────────────┘              └──────────────────────────┘
```

### Deployment Modes

- **Modular Monolith** (default for local dev):
  All modules run inside a single, unified FastAPI process with unified lifespan and connection pooling. The `app/main.py` aggregates all routers seamlessly. Run with `uvicorn app.main:app`.

- **Microservices** (Docker Compose / Production):
  Each module operates as an independent FastAPI instance (`app/<module>/main.py`) running on isolated ports (8001–8007). An API Gateway (Nginx or FastAPI Gateway) routes traffic and protects internal routes. Run with `docker compose up`.

### Data Ingestion & AI Enrichment Pipeline

1. **Multi-Category Wikimedia Ingestion**:
   When users browse historical dates, the system queries cached events in PostgreSQL. If un-cached, it pulls concurrently across five Wikimedia feeds:
   - **Selected** (Curated top historical milestones)
   - **Events** (Key global historical occurrences)
   - **Births** (Notable historical figures born on this day)
   - **Deaths** (Notable historical figures who passed away on this day)
   - **Holidays** (Global observances, sacred commemorations, and seasonal festivities)

2. **Automated AI Hook Generation (`ai_hook`)**:
   - Curated daily events are enriched with curiosity-sparking hooks via **Groq's high-speed inference cloud** using the **`allam-2-7b`** model.
   - Generates standardized hooks strictly following the pattern: *"Did you know that...?"* (single sentence under 25 words).
   - Optimized with HTTP persistent connection pooling (`httpx.AsyncClient` with keep-alive) and targeted enrichment to ensure fast sync times (< 20 seconds for 400+ events) with zero rate-limit issues.


---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Web Framework | FastAPI 0.115 |
| ORM | SQLAlchemy 2 (async) + asyncpg |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Validation | Pydantic v2 |
| HTTP Client | httpx (async, shared client with lifespan) |
| WebSocket | FastAPI WebSocket + starlette |
| Testing | pytest + pytest-asyncio + httpx |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 |
| Routing | React Router v7 |
| State | React Context (AuthContext, ToastContext) |
| Styling | Tailwind CSS + custom CSS variables |
| Animation | Framer Motion |
| Charts | Chart.js |
| Icons | Lucide React |
| Testing | Vitest |
| Build | Vite (code splitting, lazy routes) |

### Infrastructure
| Layer | Technology |
|---|---|
| Container | Docker + Docker Compose |
| Reverse Proxy | Nginx (WebSocket + SPA fallback) |
| Database | PostgreSQL 16 |
| CI | GitHub Actions |

---

## Project Structure

```
HistoFacts/
├── .env.example                  # Root env variable template
├── .github/
│   └── workflows/ci.yml          # CI: backend tests + frontend tests + build
├── docker-compose.yml            # Full microservices deployment
├── gateway/
│   ├── Dockerfile
│   └── nginx.conf                # Nginx reverse proxy + WebSocket upgrade
├── backend/
│   ├── .env.example              # Backend-specific env template
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   │       ├── 2026_08_22_..._initial_schema.py
│   │       ├── 2026_08_24_..._add_wallets_and_quiz_sessions.py
│   │       └── 2026_09_15_..._add_ai_hook_to_historical_events.py
│   ├── app/
│   │   ├── main.py               # Modular-monolith entrypoint (all routers)
│   │   ├── core/
│   │   │   ├── config.py         # Settings (env-driven via pydantic-settings)
│   │   │   ├── database.py       # Async SQLAlchemy engine + session factory
│   │   │   ├── deps.py           # Shared FastAPI dependencies (auth, internal)
│   │   │   ├── security.py       # JWT creation/decode + password hashing
│   │   │   └── inter_service.py  # Inter-microservice HTTP client
│   │   ├── auth/                 # Users, JWT login/register, friends
│   │   ├── history/              # Events, bookmarks, Wikimedia sync, Groq AI enrich
│   │   │   ├── router.py         # Dates, search (paginated), bookmarks
│   │   │   ├── sync.py           # Wikimedia 5-category feed synchronizer
│   │   │   ├── enrich.py         # Groq (allam-2-7b) AI hook generator
│   │   │   ├── models.py         # HistoricalEvent (with ai_hook)
│   │   │   └── schemas.py        # Pydantic v2 event schemas
│   │   ├── social/               # Posts, comments, likes
│   │   ├── groups/               # Groups, members, group notes
│   │   ├── ai_notes/             # Notes, token wallet, Histoins, shop
│   │   ├── quiz/                 # Questions, attempts, sessions, WS lobby
│   │   ├── notifications/        # User notifications, unread counts, WebSocket
│   │   └── gateway/              # FastAPI gateway (microservices mode)
│   └── tests/
│       ├── test_auth.py          # Registration, login, friends
│       ├── test_history.py       # Events, date lookup, search, bookmarks
│       ├── test_social.py        # Social feeds, posts, comments, likes
│       ├── test_groups.py        # Study groups and memberships
│       ├── test_ai_notes.py      # Note generation and token wallets
│       ├── test_quiz.py          # Quizzes, leaderboard, and rewards
│       ├── test_gateway.py       # Gateway microservice routing
│       ├── test_chat.py          # Direct and group chat messaging
│       ├── test_notifications.py # Internal notifications and resilience
│       ├── test_profile.py       # Profile updates, avatars, presence
│       ├── test_profile_round2.py# 2FA TOTP, sessions, data export, blocks
│       └── test_migrations.py    # Alembic PostgreSQL migration tests
└── front-end/
    ├── Dockerfile
    ├── nginx.conf                 # SPA routing fallback (try_files)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx               # React Router + lazy-loaded route tree
        ├── api/                  # Per-module API client functions
        ├── components/           # Shared components (Navbar, Layout, Icons)
        ├── contexts/             # AuthContext, ToastContext
        ├── features/
        │   ├── quiz/             # Quiz hub, personalized, lobby, global, history
        │   └── ai-notes/         # Notes sidebar, markdown viewer, shop modal
        └── pages/                # Page-level components
```

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 16 (or Docker)

### 1. Backend Setup

```bash
cd backend

# Create virtualenv
python -m venv .venv
.\.venv\Scripts\activate       # Windows
# source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and SECRET_KEY

# Run database migrations
alembic upgrade head

# Start the server (modular monolith mode)
uvicorn app.main:app --reload --port 8000
```

Backend API available at: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd front-end

npm install

# Start Vite dev server
npm run dev
```

Frontend available at: `http://localhost:5173`

The Vite dev server proxies `/api/*` to `localhost:8000` (configure in `vite.config.js`).

### 3. Running as Microservices (Local, without Docker)

```bash
cd backend
python run_microservices.py
```

This starts all 6 service processes on ports 8001–8006 and a gateway on 8000.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Async PostgreSQL URL | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing secret (change in production!) | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |
| `GROQ_API_KEY` | API key for Groq Cloud LLM (`allam-2-7b`) for real-time AI hooks | — |
| `WIKIMEDIA_API_TOKEN` | Optional Wikimedia personal access token | — |
| `LLM_API_KEY` | API key for AI note generation | — |
| `LLM_PROVIDER` | LLM provider name | `openai` |
| `NOTES_SERVICE_URL` | URL of AI Notes microservice | `http://127.0.0.1:8005` |
| `NOTIFICATION_SERVICE_URL` | URL of Notification microservice | `http://127.0.0.1:8007` |

> [!IMPORTANT]
> Always set a cryptographically strong `SECRET_KEY` in production. The fallback value is intentionally weak and only for local development.

---

## Database Migrations

HistoFacts uses Alembic for schema migrations.

```bash
cd backend

# Apply all migrations to latest version
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe_your_change"

# Downgrade one step
alembic downgrade -1

# Downgrade to empty (drops all tables)
alembic downgrade base

# View migration history
alembic history
```

### Migration Files

| Migration | Key Tables & Columns |
|---|---|
| `2026_08_22_initial_schema` | `users`, `friends`, `historical_events`, `bookmarks`, `posts`, `comments`, `likes`, `notes`, `group_shared_notes`, `groups`, `group_members`, `quiz_questions`, `quiz_attempts` |
| `2026_08_24_add_wallets_and_quiz_sessions` | `user_token_wallets`, `token_ledger`, `histoin_wallets`, `histoin_ledger`, `token_packs`, `quiz_sessions` |
| `2026_08_28_add_chat_tables` | `direct_messages`, `group_chat_messages`, `conversations`, `conversation_reads` |
| `2026_08_29_friend_requests_and_presence` | `friend_requests`, user presence status tracking |
| `2026_09_02_community_forum_enhancements` | Threaded discussions, upvotes, forum categories |
| `2026_09_05_index_created_at_ledger_messages` | High-performance indexes on ledger and message timestamps |
| `2026_09_06_add_unread_count_to_conversation_reads` | Unread badge counts for chat threads |
| `2026_09_06_add_profile_fields_to_users` | Avatars, bio sanitization, custom tags |
| `2026_09_14_profile_round2_fields_and_tables` | 2FA TOTP secrets, user sessions, audit log, account deletion |
| `2026_09_15_add_ai_hook_to_historical_events` | Adds `ai_hook` (Text, nullable) to `historical_events` for Groq curiosity hooks |

---

## Testing

### Backend Tests (pytest)

```bash
cd backend
.\.venv\Scripts\pytest -v
```

Expected: **32 passed, 1 skipped (33 total)**

> [!NOTE]
> **Why is 1 test skipped?**  
> `tests/test_migrations.py::test_alembic_migrations` is marked with `@pytest.mark.skip(reason="Migrations designed for PostgreSQL, not SQLite-compatible")`.  
> The pytest test suite uses an ultra-fast, in-memory SQLite database for test runs. Alembic migrations use PostgreSQL-native types and dialects that cannot be applied to SQLite. In production, Alembic migrations run against PostgreSQL via `alembic upgrade head`. All **32 functional and security tests pass 100%**.

| Test File | Coverage |
|---|---|
| `test_auth.py` | Registration, duplicate email rejection, password validation, login, friends flow |
| `test_history.py` | Events date sync, date filtering, paginated search (`limit`/`offset`), bookmarks CRUD |
| `test_social.py` | Posts, threaded comments, likes, feed pagination |
| `test_groups.py` | Study group creation, membership invitations, group notes sharing |
| `test_ai_notes.py` | Note generation, token wallet init, token deduction, Histoin rewards |
| `test_quiz.py` | Quiz questions, attempt validation, session persistence, leaderboard |
| `test_gateway.py` | Gateway route resolution and proxying |
| `test_chat.py` | Direct messaging and group chat flow |
| `test_notifications.py` | Internal notification creation, unread counts, fire-and-forget resilience |
| `test_profile.py` | Profile updates, bio sanitization, avatar replacement, password & email change |
| `test_profile_round2.py` | 2FA TOTP & backup codes, session revocation, data export ZIP, user blocks |
| `test_migrations.py` | Skipped under SQLite (PostgreSQL migration verification) |


### Frontend Tests (Vitest)

```bash
cd front-end
npm test
```

Expected: **11 tests, 0 failures**

| Test File | Coverage |
|---|---|
| `tokenEstimator.test.js` | Token estimation utilities (8 test cases) |
| `client.test.js` | API client auth header injection (3 test cases) |

### Production Build Verification

```bash
cd front-end
npm run build
```

Expected: Successful build with code-split chunks, no errors.

---

## Docker Compose Deployment

### Prerequisites
- Docker Desktop
- A `.env` file at repository root (copy from `.env.example`)

### Start All Services

```bash
# Build and start everything
docker compose up --build

# Or run in background
docker compose up --build -d
```

### Service Ports

| Service | Port | Description |
|---|---|---|
| `api-gateway` | `8000` | Nginx gateway (public entrypoint) |
| `auth-service` | `8001` | Auth & identity microservice |
| `history-service` | `8002` | History content microservice |
| `social-service` | `8003` | Social discussion microservice |
| `groups-service` | `8004` | Groups microservice |
| `notes-service` | `8005` | AI Notes & token economy microservice |
| `quiz-service` | `8006` | Quiz & assessment microservice |
| `frontend` | `3000` | React SPA (Nginx) |
| `postgres` | `5432` | PostgreSQL database |

### Run Migrations in Docker

```bash
docker compose exec auth-service alembic upgrade head
```

### Stop Services

```bash
docker compose down

# Also remove volumes (⚠️ deletes all data)
docker compose down -v
```

---

## WebSocket Multiplayer Lobby

HistoFacts implements a Kahoot-style multiplayer quiz using native FastAPI WebSockets.

### Connection Flow

```
Client                    Server
  │                          │
  ├─── WS connect (+ ?token=<JWT>) ───►│
  │◄── accept ─────────────────────────│
  │                          │
  ├─── { type: "join", token, username, tag, role } ──►│
  │    Server validates JWT, resolves role             │
  │◄── { type: "room_state", ...snapshot } ────────────│
  │                          │
  │     [quiz in progress]   │
  ├─── { type: "submit_answer", selected_option } ─────►│
  │◄── { type: "answer_acknowledged", score } ──────────│
  │◄── { type: "participants_update" } ─────────────────│ (broadcast)
```

### Host Authorization

Room control actions (`start_quiz`, `show_leaderboard`, `next_question`, `tick`) are **only executable by the room host**. The server validates `user_id == room.host_id` after JWT authentication. Non-host clients receive a `{ type: "error", message: "Unauthorized" }` response.

### WebSocket URL

```
ws://localhost:8000/api/quiz/ws/lobby/{room_code}?token=<access_token>
```

---

## Security Architecture

### Authentication
- JWT access tokens (30 min TTL) + refresh tokens (7 days TTL)
- Passwords hashed with bcrypt
- All protected endpoints use `get_current_user` dependency
- Optional auth endpoints use `get_optional_current_user`

### Internal Service Authorization
Internal inter-service endpoints (`/api/wallet/internal/*`) are protected with a shared secret:
- Server validates `X-Internal-Secret: <SECRET_KEY>` header
- The API gateway blocks all `/internal/` paths from external traffic (HTTP 403)
- Inter-service clients supply the header automatically via `inter_service.py`

### WebSocket Security
- JWT token validated on WebSocket connect (via query param `?token=` and `join` message payload)
- Unauthenticated users join as guests with `role: player` only — they cannot claim host privileges
- Host-only actions enforced server-side, not client-side

### CORS
- `allow_origins` driven by `settings.cors_origins` (parsed from `CORS_ORIGINS` env var)
- No wildcard `*` when `allow_credentials=True`

---

## Troubleshooting

### Backend won't start — `DATABASE_URL not set`
Copy `backend/.env.example` to `backend/.env` and set your PostgreSQL URL.

### `alembic upgrade head` fails — table already exists
The database has partial schema. Run `alembic downgrade base` first, then `alembic upgrade head`.

### WebSocket connection fails in development
Ensure the backend is running on port 8000. In `useLobbySocket.js`, the WS URL targets port 8000 when running from Vite dev server ports (5173, 3000).

### Frontend shows `Network Error` for all API calls
Ensure the backend is running on `http://localhost:8000`. The frontend API client (`front-end/src/api/client.js`) connects directly to `http://localhost:8000` via browser `fetch()` with CORS enabled (backend allows `http://localhost:5173` via `CORS_ORIGINS`). If using a custom API URL or port, set `VITE_API_URL` in `front-end/.env`.

### Pydantic warnings about `class Config`
All schemas have been migrated to `ConfigDict`. If you see warnings, check for any custom schemas not yet updated.

### Tests fail on Windows — `PermissionError` on SQLite cleanup
Known Windows limitation: the SQLite test DB file may be locked. The test suite handles this with `engine.dispose()` in teardown. If it persists, delete `backend/test_migrations.db` manually.

---

## License

MIT License — see [LICENSE](LICENSE) for details.