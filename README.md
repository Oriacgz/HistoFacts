# HistoFacts

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="docs/assets/histofacts-banner.png">
    <img src="docs/assets/histofacts-banner.gif" alt="HistoFacts: discover history, explore monuments, study with AI, and test your knowledge." width="1100">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/Oriacgz/HistoFacts/actions/workflows/ci.yml"><img src="https://github.com/Oriacgz/HistoFacts/actions/workflows/ci.yml/badge.svg" alt="HistoFacts CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-d6b975?style=flat-square" alt="MIT license"></a>
</p>

**Explore the past. Build understanding. Remember what matters.**

HistoFacts is a history learning platform built with React and FastAPI. Discover events, explore illustrated 3D monuments, develop study notes with local AI, and practice through personalized and multiplayer quizzes.

[Quick start](#quick-start) · [Features](#features) · [AI configuration](#ai-configuration) · [Architecture](#architecture) · [Testing](#testing) · [Contributing](#contributing)

[View the static banner](docs/assets/histofacts-banner.png)

## Features

| Area | What you can do |
| --- | --- |
| Today in History | Browse date-specific historical events, search the collection, and bookmark discoveries. Wikimedia supplies historical event feeds; optional AI enrichment adds short hooks. |
| Monument Explorer | Search the Great Pyramid, Taj Mahal, and Qutub Minar; rotate and zoom bundled 3D illustrations; explore annotated points and guided tours; save favorites and tour completion. Prepare a quiz or study-note prompt from a monument. |
| AI Notes | Stream history-focused answers, continue conversations, attach study material, choose Think mode, create handwritten-style notes, and export printable PDFs. Image input requires Think mode. |
| Session memory | Keep separate, private context for every conversation across Llama and Qwen. Use a bounded sliding window, source-linked extractive memory, and same-session retrieval. Manage memory in Profile Settings. |
| Web Research | Optionally retrieve web evidence through Tavily, generate cited answers, and inspect saved sources. Requires a server-side key; Think alone does not search the web. |
| Quizzes | Practice with topic/PDF-based personalized quizzes, real-time multiplayer lobbies, quiz history, and a global leaderboard. |
| Community | Discuss history, collaborate in Study Groups, connect with friends, and share notes through chat. |
| Study economy | Track AI study credits, earn Histoins through quiz participation, and use the token shop. |
| Account settings | Manage profile details, sessions, preferences, notification choices, memory, account export, and deletion. |

### Monument viewing and AR

The current experience is **camera-free interactive 3D**, suitable for a laptop. Models are bundled, simplified educational illustrations, not generated on demand or accurate architectural reconstructions. Physical AR placement depends on compatible device/browser support and is not claimed as verified. See the [Monument Explorer guide](docs/monument-explorer.md).

### How Notes memory works

```mermaid
flowchart LR
    A[Your conversation] --> B[Owner-scoped session memory]
    B --> C[Bounded recent turns + older excerpts]
    C --> D{Think enabled?}
    D -->|No| E[Llama: standard answer]
    D -->|Yes| F[Qwen: reasoning answer]
    E --> G[Save completed turn to this session]
    F --> G
    G --> B
```

- Each conversation has its own memory. Switching models preserves the same session context; switching conversations does not merge their histories.
- A circular indicator beside Send shows the **estimated 150K logical session buffer**. With automatic compaction enabled, older turns compact at that threshold while original notes stay readable.
- This is separate from model capacity: the configured **8,192-token runtime context** reserves output and a safety margin, leaving a conservative **5,632 estimated input-token budget** for ordinary generation. The application does not send a 150K prompt to an 8K model.
- **Profile Settings → Privacy & Preferences → AI Notes Memory** provides account/per-session controls, Minimal/Balanced/Detailed modes, inspect, compact, rebuild, reset, export, and delete.
- Disabling memory preserves it and stops history injection. Reset keeps notes readable but excludes earlier turns from future memory until an explicit rebuild.
- Optional local Nomic retrieval is disabled by default. Compaction does not deduct study-wallet credits. Memory excerpts are conversation claims, not verified historical facts.

The server checks history relevance before answer generation. Ambiguous requests use the fast Llama endpoint; an unclear result or unavailable classifier is rejected rather than allowed through. This applies to standard, Think, and Web Research paths. See [scope behavior and tests](docs/ai-notes-history-scope.md).

## Quick start

### Prerequisites

- Python **3.11** is used in CI.
- Node.js **20.19+** or **22.12+**, matching the installed Vite engine requirement; CI currently selects Node.js 20.
- A running PostgreSQL instance; the Compose development database uses PostgreSQL 16.
- For AI features: Ollama with an installed Llama model, plus LM Studio with an installed Qwen model for Think. Match configuration to the exact model IDs available locally.
- A running Redis instance for multiplayer lobby state.

The commands below use **PowerShell**. On macOS/Linux, use `source venv/bin/activate` and `cp` in place of the Windows activation/copy commands.

### 1. Backend

From the repository root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your PostgreSQL `DATABASE_URL`, a private `SECRET_KEY`, and the AI endpoints you intend to use. Create the database named in the URL before applying migrations.

```powershell
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API: <http://127.0.0.1:8000>
- Interactive API documentation: <http://127.0.0.1:8000/docs>

### 2. Frontend

Open a second terminal from the repository root:

```powershell
cd front-end
npm ci
npm run dev
```

Open the Vite URL printed in the terminal, normally <http://localhost:5173>. Register an account and sign in to use protected features.

The frontend API client defaults to the browser's hostname on port **8000**; there is no Vite API proxy configured. To use a different API address, create `front-end/.env.local`:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
```

Restart Vite after changing frontend environment variables. Include the frontend origin in backend `CORS_ORIGINS`.

### 3. Alternative: local microservices

Use this **instead of** the monolith on port 8000:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python run_microservices.py
```

The supervisor applies migrations, then starts **seven services and a Python gateway**. Stop the supervisor with `Ctrl+C` to stop its child services.

| Process | Port |
| --- | --- |
| API Gateway | 8000 |
| Auth | 8001 |
| History and monuments | 8002 |
| Social | 8003 |
| Study Groups | 8004 |
| AI Notes and wallets | 8005 |
| Quiz and multiplayer | 8006 |
| Notifications | 8007 |

## AI configuration

Use the examples in [backend/.env.example](backend/.env.example). These settings select existing models; application startup does not download them.

| Variable | Purpose / example |
| --- | --- |
| `NOTES_LLM_BASE_URL` | Standard Notes and topic classifier: `http://127.0.0.1:11434/v1` |
| `NOTES_LLM_MODEL` | Fast installed model, e.g. `llama3.2:3b` |
| `NOTES_THINKING_LLM_BASE_URL` | Think endpoint, e.g. `http://localhost:1234/v1` |
| `NOTES_THINKING_LLM_MODEL` | Exact loaded Qwen ID, e.g. `qwen3-vl-4b-thinking` |
| `LLM_BASE_URL`, `LLM_MODEL` | Fallback Think configuration when the thinking overrides are absent |
| `LLM_API_KEY` | Inference API key; local endpoints commonly use `not-needed` |
| `QUIZ_LLM_BASE_URL`, `QUIZ_LLM_MODEL` | Independent quiz model selection; defaults target local Llama |
| `QUIZ_GENERATION_TIMEOUT_SECONDS` | Quiz generation timeout; default `150` |
| `NOTES_CONTEXT_LIMIT` | Must match the loaded model's context; default `8192` |
| `NOTES_SESSION_WINDOW_TOKENS` | Logical session compaction threshold; default `150000` |
| `NOTES_MEMORY_DENSE_ENABLED` | Optional installed `nomic-embed-text` retrieval; default `false` |
| `TAVILY_API_KEY` | Optional server-only Web Research key; blank leaves live search unavailable |

Run Ollama for standard Notes and history classification, including ambiguous questions submitted in Think mode. For reasoning answers, also start LM Studio's local API server and load Qwen. Choosing Think does not silently switch to Llama if Qwen is unavailable. Reasoning output is filtered from displayed answers.

Think and Web Search are independent options in the composer dropdown. Think requests reasoning; Web Search retrieves sources. Neither model reasoning nor citations guarantee factual accuracy.

### Other configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Async SQLAlchemy URL, e.g. `postgresql+asyncpg://postgres:password@localhost:5432/histofacts` |
| `SECRET_KEY` | Private JWT signing secret; use the same value across local services |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `REDIS_URL` | Redis connection for lobby state; default `redis://localhost:6379/0` |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Optional history-feed AI enrichment |
| `WIKIMEDIA_API_TOKEN` | Optional Wikimedia access token |
| `TENOR_API_KEY` | Optional GIF search in community/chat |

Keep secrets in ignored local environment files. `.env.example` files contain configuration examples, not credentials.

## Architecture

```mermaid
flowchart TB
    UI[React 19 + Vite frontend] --> API[FastAPI monolith OR API gateway]
    API --> AUTH[Auth / profile]
    API --> HISTORY[History / monuments]
    API --> NOTES[AI Notes / memory / wallets]
    API --> QUIZ[Quizzes / WebSocket lobbies]
    API --> COMMUNITY[Social / groups / chat / notifications]
    AUTH --> DB[(PostgreSQL)]
    HISTORY --> DB
    NOTES --> DB
    QUIZ --> DB
    COMMUNITY --> DB
    QUIZ --> REDIS[(Redis lobby state)]
    NOTES --> LLAMA[Local Ollama / Llama]
    NOTES --> QWEN[Local LM Studio / Qwen]
    NOTES --> SEARCH[Optional Tavily research]
    HISTORY --> WIKI[Wikimedia feeds]
```

The UI uses React Router, Tailwind CSS, Markdown rendering, and a lazy-loaded `model-viewer` for monuments. The backend uses FastAPI, Pydantic, async SQLAlchemy, Alembic, and OpenAI-compatible inference clients. Notes stream through SSE; multiplayer uses WebSockets.

Authentication uses JWT access/refresh tokens and password hashing. Owner checks protect private Notes sessions and memory; shared-note responses omit private memory. Internal service routes require a shared secret and are blocked at the public gateway. These implemented controls are not a substitute for deployment security testing.

```text
HistoFacts/
├── backend/
│   ├── app/
│   │   ├── ai_notes/          # Notes, context, research and wallets
│   │   ├── auth/              # Authentication and account settings
│   │   ├── history/           # Historical feeds and monument catalogue
│   │   ├── quiz/              # Generation, sessions and multiplayer
│   │   ├── social/            # Community discussions
│   │   ├── groups/            # Study Groups
│   │   ├── chat/              # Shared conversations and messaging
│   │   ├── notification/      # Notifications and Notes presence
│   │   └── gateway/           # Python microservice gateway
│   ├── alembic/versions/      # Database migrations
│   ├── scripts/               # Reproducible acceptance checks
│   ├── tests/                 # Unit/integration tests and fixtures
│   └── run_microservices.py   # Local service supervisor
├── front-end/
│   ├── src/                  # Pages, features, contexts and API clients
│   ├── public/models/        # Bundled monument models and posters
│   └── scripts/              # Monument asset/registry checks
├── gateway/                  # Nginx gateway configuration
├── docs/                     # Feature guides and README media
└── docker-compose.yml
```

## Database migrations

From `backend`, with the intended database configured:

```powershell
python -m alembic current
python -m alembic upgrade head
python -m alembic history
```

Recent migrations include monument learning, retained research evidence, research usage details, and session memory. Back up existing data before schema changes. If an existing schema conflicts with migration history, inspect the revision state and table definitions; do not blindly downgrade to `base`, which can delete application data.

## Testing

### Frontend

```powershell
cd front-end
npm test
npm run lint
npm run models:validate
npm run build
```

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m pip install -r tests/requirements-quiz.txt
python -m pytest
```

A focused history-scope and model-routing gate:

```powershell
python -m pytest tests/test_notes_history_scope.py tests/test_notes_research_lifecycle.py tests/test_ai_notes_model_routing.py -q
```

Local verification on **25 October 2026** included 118 frontend tests with lint/build, and a separate 56-test backend scope/research/routing gate. The memory UI redesign subsequently passed its three interaction tests, lint/build, and browser inspection. These are dated local results, not a claim that every backend test or the latest remote CI run passes. The badge above reads the actual repository workflow status.

The test suite uses isolated SQLite fixtures for many integration checks. Local real-model samples and synthetic evidence tests are distinct from live web retrieval and deployed behavior. See the feature verification records below for limits.

Optional manual acceptance scripts, run from `backend`:

```powershell
python scripts/research_acceptance.py --mode both
python scripts/session_retrieval_acceptance.py
```

These checks require the relevant installed model services. Research uses fixture evidence unless `--live` is explicitly supplied with a configured key. Reports default to Git-ignored `.local-artifacts/reports/`. Generated QA databases, caches, reports, uploads, dependencies, and build output do not belong in commits; necessary source JSON catalogues and model assets do.

## Docker Compose

The repository includes a multi-service Compose configuration with PostgreSQL, Redis, Nginx, backend services, and a frontend on port 3000:

```powershell
docker compose up --build
```

Treat this as a development scaffold, not a verified production deployment. Review default secrets, migration execution, service environment variables, and model endpoints first. The current Compose file does not propagate all newer Notes/research settings. Inside a container, `localhost` refers to that container, so host-based model servers need an explicitly reachable address. The local setup above is the documented path for the latest AI features.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Frontend cannot reach the API | Start the backend on port 8000, check `VITE_API_URL`, and allow the frontend origin in `CORS_ORIGINS`. |
| Standard Notes or topic checks are unavailable | Check Ollama and the exact `NOTES_LLM_MODEL` ID. Unknown topics fail closed when classification is unavailable. |
| Think fails while standard Notes works | Start LM Studio's API server, load the configured Qwen model, and check its runtime context. |
| Context budget error | Match `NOTES_CONTEXT_LIMIT` to the loaded model; shorten oversized messages/attachments. The 150K buffer is not the model's input limit. |
| Web Search is disabled | Set a private backend `TAVILY_API_KEY` and restart the Notes service. Think alone does not provide internet access. |
| Model returns an inaccurate claim | Check the cited evidence or primary sources. Memory and reasoning are not factual verification. |
| Personalized quiz times out | Check the quiz endpoint/model and input size. Generation has a bounded timeout; do not assume an elapsed timer means useful model progress. |
| Database tables are missing | Apply migrations against the same database used by the running services. |

## Documentation

- [Monument Explorer](docs/monument-explorer.md)
- [Llama/Qwen routing](docs/ai-notes-model-routing.md)
- [History-only scope](docs/ai-notes-history-scope.md)
- [Web Research](docs/ai-notes-web-research.md)
- [Session memory implementation and verification](ai-notes-session-context-verification.md)
- [Web Research implementation and verification](ai-notes-web-research-verification.md)
- [Notes notification presence](docs/ai-notes-notifications.md)

Some guides contain historical test counts and timings from earlier implementation stages. Consult their dated updates; removed local report filenames are evidence references, not required runtime files.

## Contributing

Developers, historians, educators, designers, and documentation contributors are welcome.

1. Search existing issues and discuss substantial feature/schema changes before implementation.
2. Create a focused branch, preserve unrelated behavior, and update documentation alongside the change.
3. Add appropriate regression coverage; run affected tests, lint, build, and model validation when applicable.
4. Open a pull request with the concrete problem, resulting behavior, validation, and remaining limitations.

Enforce ownership and permissions on the server. Preserve accessible labels, keyboard controls, responsive layouts, and reduced-motion behavior. Never commit secrets, user data, generated reports, or local databases. Report exploitable security issues privately to maintainers rather than publishing reproduction details in a public issue.

## License

[MIT](LICENSE) · Copyright © 2026 Apoorva Puranik.
