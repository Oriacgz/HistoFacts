# HistoFacts

> **Daily Facts and Stories from the Past**  
> A modern, microservices-ready historical learning platform featuring daily historical events, AI-powered curriculum notes with a token economy, handwritten notes styling, interactive quizzes, and community study circles.

---

## Architecture Overview

HistoFacts is architected into **6 independent domain microservices** fronted by an **API Gateway**, allowing seamless local development as well as containerized multi-service deployment.

```
                               ┌────────────────────────┐
                               │ React Frontend (SPA)   │
                               └───────────┬────────────┘
                                           │ http://localhost:8000/api/*
                                           ▼
                               ┌────────────────────────┐
                               │      API Gateway       │
                               │ (Nginx / FastAPI Proxy)│
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
                        │   PostgreSQL Database  │
                        │ (Isolated Domain Data) │
                        └────────────────────────┘
```

### The 6 Independent Microservices

| Service | Port | Entrypoint | Endpoints | Description |
|---|---|---|---|---|
| **1. Auth & Identity** | `:8001` | `app.auth.main:app` | `/api/auth/*` | Registration, JWT login & refresh, unique 4-digit `#tag` generator, user search |
| **2. History Content** | `:8002` | `app.history.main:app` | `/api/events/*` | Today's facts feed, calendar date browser, keyword search, bookmarks, resilient Wikimedia sync |
| **3. Social Discussion** | `:8003` | `app.social.main:app` | `/api/social/*` | Public Chronicle feed, threaded nested replies (`parent_comment_id`), like counter |
| **4. Groups Service** | `:8004` | `app.groups.main:app` | `/api/groups/*` | Group creation, membership roles (`admin`/`member`), group discussion circles |
| **5. AI Notes & Economy** | `:8005` | `app.ai_notes.main:app` | `/api/notes/*`<br>`/api/wallet/*`<br>`/api/shop/*` | LLM curriculum notes synthesis, multi-format attachments (PDF/docs/images), handwritten notes restyling, token quota wallet, Histoins token pack shop |
| **6. Quiz & Assessment** | `:8006` | `app.quiz.main:app` | `/api/quiz/*` | Topic-based question bank, attempt tracking, accuracy scoring, and +20 Histoin reward earnings |

---

## Tech Stack

### Frontend
- **React 19** with Vite
- **TailwindCSS 4** with custom parchment palette & typography tokens
- **Framer Motion** for transitions
- **Google Fonts** (`Playfair Display`, `Lora`, `Poppins`, `Caveat`, `Patrick Hand`)
- **Lucide React** for icons
- **React Router v7**

### Backend & Microservices
- **FastAPI** (Python 3.11 asynchronous microservices)
- **SQLAlchemy 2.0 (Asyncio)** + **asyncpg** + **aiosqlite** (testing)
- **PostgreSQL 16** (with UUID keys and audit ledgers)
- **Alembic** for schema migrations
- **JWT Authentication** (access token + refresh token)
- **Pytest** + **Pytest-Asyncio** for automated testing (100% passing)

### Deployment & Gateway
- **API Gateway**: Nginx reverse proxy (production) / FastAPI Proxy (development)
- **Docker & Docker Compose** for multi-container deployment
- **GitHub Actions CI** for automated test & build verification

---

## Key Features

### 1. Daily Historical Events & Discovery
- **"On This Day" Facts**: Curated historical events synced automatically from Wikimedia with exponential backoff retry.
- **Date Browser & Search**: Explore history by specific date (`MM-DD`) or full-text keyword search.
- **Bookmarks**: Save historical events to your personal study library.

### 2. AI Notes, Token Economy & Handwritten Style
- **Curriculum-Aware Generation**: Grounded notes tailored to NCERT, CBSE, UPSC, and international syllabi.
- **Multi-Format Attachment Support**: Attach PDFs, Word docs (`.docx`), Markdown, text files, and images for AI analysis.
- **Token Quota System**:
  - **350,000 Signup Bonus Tokens** for new accounts.
  - **Lazy Daily Refill**: +50,000 free tokens/day up to a 350,000 free cap (back-fills multiple missed days).
  - **Atomic Deductions**: Pre-flight token check before LLM calls and row-level locking (`with_for_update`) to prevent race conditions.
  - **Live Cost Estimator**: Debounced live cost estimate while typing.
- **Histoins Virtual Currency & Token Pack Shop**:
  - Earn Histoins via daily login (+10 🪙) and correct quiz answers (+20 🪙).
  - Exchange Histoins for token packs in the shop (Starter: 50K for 100 🪙, Popular: 150K for 250 🪙, Mega: 350K for 500 🪙).
- **Handwritten Notes Styling**:
  - Convert any formal note into student lecture notes with abbreviations (`govt`, `b/c`, `w/`), arrows (`→`), and bold highlights.
  - Rendered on a lined notebook canvas with red margin line and handwriting typography.

### 3. Community & Social Features
- **Public Chronicle Feed**: Post historical observations, ask questions, and share insights.
- **Threaded Comment Hierarchy**: Nested discussions via self-referencing `parent_comment_id`.
- **Study Groups**: Create private groups, invite friends, and share study notes.
- **Unique Handles**: Discord-style username and 4-digit unique tag (e.g. `Scholar#4102`).

### 4. Interactive Quizzes
- Topic-based question banks covering ancient, medieval, modern, and world history.
- Immediate feedback, score calculation, and Histoin rewards.

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ / 20+
- PostgreSQL 16+ (or Docker)

---

### Running the Application

#### Method 1: Local Microservices Runner (Recommended for Dev)
Spawns all 6 microservice processes + the API Gateway concurrently with color-coded logging:

```bash
# 1. Setup Backend
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run all 6 microservices + API Gateway
python run_microservices.py
```

In a second terminal, start the frontend:
```bash
# 2. Setup Frontend
cd front-end
npm install
npm run dev
```

- **Frontend SPA**: http://localhost:5173
- **Unified API Gateway**: http://localhost:8000
- **Gateway Health Matrix**: http://localhost:8000/health

---

#### Method 2: Docker Compose (All-in-One Containerized Setup)
Builds and starts all 6 microservice containers, PostgreSQL, and the Nginx API Gateway:

```bash
docker compose up --build
```

- **API Gateway (Nginx)**: http://localhost:8000
- **Frontend SPA**: http://localhost:5173 (or containerized port)
- **Auth Microservice**: http://localhost:8001
- **History Microservice**: http://localhost:8002
- **Social Microservice**: http://localhost:8003
- **Groups Microservice**: http://localhost:8004
- **AI Notes Microservice**: http://localhost:8005
- **Quiz Microservice**: http://localhost:8006

---

## Running Automated Tests

Run the backend test suite across all 6 modules and the API Gateway (using in-memory SQLite):

```bash
cd backend
pytest -v
```

All 11 test suites verify:
- Registration, JWT auth, refresh tokens, unique `#tag` generator
- Events date browser, keyword search, bookmarks CRUD
- Chronicle posts, threaded replies, like counter
- Groups lifecycle and member feeds
- AI notes synthesis, token wallet deduction, handwritten notes restyling, token pack shop purchases
- Quiz evaluation and Histoin rewards
- API Gateway routing and service resolution

---

## API Gateway Route Table

| Path Prefix | Destination Microservice | Direct Swagger Docs |
|---|---|---|
| `/api/auth/*` | Auth Service (`:8001`) | http://localhost:8001/docs |
| `/api/events/*` | History Service (`:8002`) | http://localhost:8002/docs |
| `/api/social/*` | Social Service (`:8003`) | http://localhost:8003/docs |
| `/api/groups/*` | Groups Service (`:8004`) | http://localhost:8004/docs |
| `/api/notes/*`<br>`/api/wallet/*`<br>`/api/shop/*` | AI Notes Service (`:8005`) | http://localhost:8005/docs |
| `/api/quiz/*` | Quiz Service (`:8006`) | http://localhost:8006/docs |
| `/health` | API Gateway Health Check | http://localhost:8000/health |

---

## Project Structure

```
HistoFacts/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI (Backend tests + Frontend build)
├── gateway/
│   ├── nginx.conf             # Production Nginx API Gateway reverse proxy
│   └── Dockerfile             # Gateway container definition
├── front-end/                 # React 19 + Vite SPA
│   ├── src/
│   │   ├── api/               # API clients (aiNotes, auth, history, quiz, social, groups)
│   │   ├── components/        # Reusable UI widgets
│   │   ├── contexts/          # Auth and Toast contexts
│   │   ├── pages/             # NotesPage, Dashboard, FeedPage, QuizPage, etc.
│   │   ├── index.css          # Tailwind theme tokens & notebook styles
│   │   └── App.jsx            # Routing and layout
│   └── package.json
├── backend/                   # FastAPI Microservices Backend
│   ├── app/
│   │   ├── auth/              # Microservice 1 (:8001) - Auth & Identity
│   │   ├── history/           # Microservice 2 (:8002) - History Content & Sync
│   │   ├── social/            # Microservice 3 (:8003) - Social Discussion
│   │   ├── groups/            # Microservice 4 (:8004) - Groups & Circles
│   │   ├── ai_notes/          # Microservice 5 (:8005) - AI Notes & Token Economy
│   │   ├── quiz/              # Microservice 6 (:8006) - Quiz & Assessment
│   │   ├── gateway/           # Development FastAPI Proxy Gateway (:8000)
│   │   └── core/              # Shared config, database, security, inter-service client
│   ├── tests/                 # Pytest test suite (11 test suites)
│   ├── run_microservices.py   # Multi-service process runner
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic/               # Database migrations
├── docs/
│   ├── project-context.md     # Master project architecture documentation
│   └── microservices-architecture.md
├── docker-compose.yml
└── README.md
```