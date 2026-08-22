# HistoFacts

A modern historical learning platform featuring daily historical events, AI-powered study notes, interactive quizzes, and community features.

## Tech Stack

### Frontend
- **React 19** with Vite
- **TailwindCSS 4** for styling
- **Framer Motion** for animations
- **React Router v7** for routing
- **Chart.js** + **react-chartjs-2** for quiz analytics
- **Lucide React** for icons

### Backend
- **FastAPI** (Python)
- **SQLAlchemy 2.0** (async) + **asyncpg**
- **PostgreSQL** with **pgvector** extension
- **Alembic** for migrations
- **JWT Authentication** (access + refresh tokens)

### Deployment
- **Docker Compose** for containerization
- Services: PostgreSQL, Backend (port 8000), Frontend (port 80)

## Features

### Core Modules
- **Daily Historical Events** - Curated "On This Day" facts from Wikipedia/Wikimedia with date browsing and search
- **AI Study Notes** - Generate curriculum-specific notes (NCERT, UPSC, AP World, etc.) using LLMs
- **Interactive Quizzes** - Topic-based quizzes with performance charts and time analytics
- **Study Groups** - Create/join groups, share notes, discuss history
- **Social Feed** - Discord-style posts, comments, replies, and likes
- **Friends System** - Search by username#tag, send/accept requests

## Project Structure

```
HistoFacts/
├── front-end/                 # React + Vite application
│   ├── src/
│   │   ├── api/              # API client modules
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (Auth, Toast)
│   │   ├── data/             # Static data
│   │   ├── pages/            # Page components
│   │   ├── App.jsx           # Main app with routing
│   │   └── main.jsx          # Entry point
│   └── package.json
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── ai_notes/         # AI note generation
│   │   ├── auth/             # Authentication
│   │   ├── core/             # Config, DB, security
│   │   ├── groups/           # Study groups
│   │   ├── history/          # Historical events & bookmarks
│   │   ├── quiz/             # Quiz questions & attempts
│   │   ├── social/           # Posts, comments, likes
│   │   └── main.py           # FastAPI app entry
│   ├── alembic/              # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 16+ with pgvector
- Docker (optional, for containerized setup)

### Development Setup

#### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```
- Frontend: http://localhost
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

#### Option 2: Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure DATABASE_URL, SECRET_KEY, etc.
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd front-end
npm install
npm run dev
```
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/histofacts
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
LLM_API_KEY=your-openai-key
LLM_PROVIDER=openai
```

## API Endpoints

| Module | Prefix | Key Endpoints |
|--------|--------|---------------|
| Auth | `/api/auth` | POST /register, POST /login, POST /refresh, GET /me, GET /search |
| History | `/api/events` | GET /today, GET /date/{month}/{day}, GET /search, POST/DELETE/GET /bookmarks |
| Quiz | `/api/quiz` | GET /questions, POST /attempt, GET /results/{session_id} |
| AI Notes | `/api/notes` | POST /generate, GET /, PUT /{id}, POST /{id}/share/{group_id} |
| Social | `/api/social` | POST /posts, GET /posts, GET /posts/{id}, POST /posts/{id}/comments, POST /posts/{id}/like |
| Groups | `/api/groups` | CRUD + membership + note sharing |

## Key Integrations

- **Wikimedia API** - Auto-syncs historical events by date
- **OpenAI-compatible LLMs** - Generates curriculum-specific study notes

## Scripts

**Frontend:**
```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

**Backend:**
```bash
uvicorn app.main:app --reload  # Dev server
alembic revision --autogenerate -m "msg"  # Create migration
alembic upgrade head  # Apply migrations
```

## License

MIT