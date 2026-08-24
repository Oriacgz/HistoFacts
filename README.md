# HistoFacts 🏛️

> **AI-powered historical education platform** — multiplayer quizzes, AI-generated study notes, a social history feed, and a token economy — all in one.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-13%2F13%20passing-brightgreen)](#testing)
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
┌──────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                  │
│  React + Vite · Code-Split Lazy Routes · WebSocket Client │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTP / WebSocket
┌─────────────────────▼────────────────────────────────────┐
│              API Gateway  (port 8000)                     │
│  Nginx (Docker) · WebSocket Upgrade · /internal block     │
│  OR FastAPI Gateway (Python) — microservice URL resolver  │
└──────┬──────────────────────────────────────┬────────────┘
       │ HTTP Proxy                           │ WS Proxy
       │                                      │
┌──────▼──────────────────────────────────────▼────────────┐
│                   FastAPI Backend                         │
│  Modular Monolith mode (default) OR Microservices mode   │
│                                                           │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │  Auth      │ │  History   │ │  Quiz (WebSocket)    │  │
│  │  :8001     │ │  :8002     │ │  :8006               │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │  Social    │ │  Groups    │ │  AI Notes + Wallet   │  │
│  │  :8003     │ │  :8004     │ │  :8005               │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
└──────────────────────────────┬───────────────────────────┘
                               │ asyncpg
┌──────────────────────────────▼───────────────────────────┐
│                   PostgreSQL Database                     │
│  19 Tables · Alembic Migrations · Async SQLAlchemy ORM   │
└──────────────────────────────────────────────────────────┘
```

### Deployment Modes

**Modular Monolith** (default for local dev):
All modules run inside one FastAPI process. The `app/main.py` aggregates all routers. Use `uvicorn app.main:app`.

**Microservices** (Docker Compose):
Each module has its own `app/<module>/main.py` FastAPI instance, exposed on a separate port. An API Gateway (Nginx or Python FastAPI) routes traffic. Use `docker compose up`.

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
│   │       └── 2026_08_24_..._add_wallets_and_quiz_sessions.py
│   ├── app/
│   │   ├── main.py               # Modular-monolith entrypoint (all routers)
│   │   ├── core/
│   │   │   ├── config.py         # Settings (env-driven via pydantic-settings)
│   │   │   ├── database.py       # Async SQLAlchemy engine + session factory
│   │   │   ├── deps.py           # Shared FastAPI dependencies (auth, internal)
│   │   │   ├── security.py       # JWT creation/decode + password hashing
│   │   │   └── inter_service.py  # Inter-microservice HTTP client
│   │   ├── auth/                 # Users, JWT login/register, friends
│   │   ├── history/              # Events, bookmarks, Wikimedia sync
│   │   ├── social/               # Posts, comments, likes
│   │   ├── groups/               # Groups, members, group notes
│   │   ├── ai_notes/             # Notes, token wallet, Histoins, shop
│   │   ├── quiz/                 # Questions, attempts, sessions, WS lobby
│   │   └── gateway/              # FastAPI gateway (microservices mode)
│   └── tests/
│       ├── test_auth.py
│       ├── test_history.py
│       ├── test_social.py
│       ├── test_groups.py
│       ├── test_ai_notes.py
│       ├── test_quiz.py
│       ├── test_gateway.py
│       └── test_migrations.py
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
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `LLM_API_KEY` | API key for AI note generation | — |
| `LLM_PROVIDER` | LLM provider name | `openai` |
| `NOTES_SERVICE_URL` | URL of AI Notes microservice | `http://127.0.0.1:8005` |

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

| Migration | Tables Created |
|---|---|
| `2026_08_22_initial_schema` | `users`, `friends`, `historical_events`, `bookmarks`, `posts`, `comments`, `likes`, `notes`, `group_shared_notes`, `groups`, `group_members`, `quiz_questions`, `quiz_attempts` |
| `2026_08_24_add_wallets_and_quiz_sessions` | `user_token_wallets`, `token_ledger`, `histoin_wallets`, `histoin_ledger`, `token_packs`, `quiz_sessions` |

### Database Tables (19 total)

`users` · `friends` · `historical_events` · `bookmarks` · `posts` · `comments` · `likes` · `groups` · `group_members` · `notes` · `group_shared_notes` · `quiz_questions` · `quiz_attempts` · `quiz_sessions` · `user_token_wallets` · `token_ledger` · `histoin_wallets` · `histoin_ledger` · `token_packs`

---

## Testing

### Backend Tests (pytest)

```bash
cd backend
.\.venv\Scripts\pytest -v
```

Expected: **13 tests, 0 failures**

| Test File | Coverage |
|---|---|
| `test_auth.py` | Register, login, duplicate email, invalid password, friends flow |
| `test_history.py` | Events search, bookmarks CRUD |
| `test_social.py` | Posts, comments, likes flow |
| `test_groups.py` | Group create, join, list |
| `test_ai_notes.py` | Note generation, wallet init, token deduction, Histoin reward |
| `test_quiz.py` | Quiz attempt, session save, Histoin reward integration |
| `test_gateway.py` | Route resolution for all microservices |
| `test_migrations.py` | Alembic upgrade to head + downgrade to base |

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
Check `vite.config.js` — the `/api` proxy target must point to `http://localhost:8000`.

### Pydantic warnings about `class Config`
All schemas have been migrated to `ConfigDict`. If you see warnings, check for any custom schemas not yet updated.

### Tests fail on Windows — `PermissionError` on SQLite cleanup
Known Windows limitation: the SQLite test DB file may be locked. The test suite handles this with `engine.dispose()` in teardown. If it persists, delete `backend/test_migrations.db` manually.

---

## License

MIT License — see [LICENSE](LICENSE) for details.