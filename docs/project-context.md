# HistoFacts — Master Project Context & Architecture

> **Daily Facts and Stories from the Past**  
> A full-stack web application designed for interactive historical learning, social discussion, AI-synthesized curriculum notes with a token economy, and knowledge testing.

---

## 1. Executive Summary & System Overview

HistoFacts combines daily historical discovery with modern interactive learning tools. The backend is designed as a **Modular Monolith** organized into **6 strict domain modules**, enabling seamless development while remaining 100% extractable into independent microservices behind an API gateway.

### Core Technology Stack

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS | Single Canvas AI chat, lined notebook styling, responsive layouts, optimistic UI |
| **Backend** | Python 3.11 + FastAPI + SQLAlchemy (Asyncio) | High performance asynchronous endpoints, row-level locking, Pydantic v2 validation |
| **Database** | PostgreSQL (+ `pgvector` compatible) | Relational persistence with UUID keys and audit ledgers |
| **Authentication** | JWT (Access Token 30m + Refresh Token 7d) | Stateless bearer authentication with unique `#tag` handles |
| **Testing & CI** | Pytest + Pytest-Asyncio + GitHub Actions | In-memory SQLite async testing and continuous build verification |

---

## 2. Architecture & Domain Module Boundaries

The backend is partitioned into 6 domain modules with strict separation of concerns:

```
HistoFacts Architecture
├── 1. Auth & Identity (/api/auth)
│   ├── User registration & password hashing (bcrypt)
│   ├── Unique handle generation (e.g. "Scholar#4102")
│   └── Friends system (pending/accepted/blocked)
├── 2. History Content (/api/events)
│   ├── Today's events & calendar date browser (/date/{month}/{day})
│   ├── Resilient Wikimedia "On This Day" sync job with exponential backoff
│   └── Bookmarks management
├── 3. Social Discussion (/api/social)
│   ├── Chronicle posts feed
│   ├── Threaded hierarchical comments (parent_comment_id)
│   └── Deduplicated like toggle
├── 4. Groups (/api/groups)
│   ├── Group creation & membership roles (admin, member)
│   └── Group-scoped discussion feeds
├── 5. AI Notes & Token Economy (/api/notes, /api/wallet, /api/shop)
│   ├── LLM study note synthesis with multi-format attachment support (PDF/docs/images)
│   ├── Handwritten note restyling (Caveat & Patrick Hand typography)
│   ├── Token Quota System (350,000 signup bonus, lazy daily refresh)
│   └── Histoins Virtual Currency & Token Pack Shop
└── 6. Quiz & Assessment (/api/quiz)
    ├── Topic-based historical question bank
    ├── Attempt tracking & accuracy calculation
    └── Histoin earning mechanism (+20 Histoins for correct answers)
```

---

## 3. Complete Database Schema

### 3.1 Identity & Social
- **`users`**: `id` (UUID PK), `username`, `tag` (4 digits), `email` (unique), `password_hash`, `preferences` (JSON), `created_at`. Unique constraint on `(username, tag)`.
- **`friends`**: `user_id` (FK PK), `friend_id` (FK PK), `status` (`pending`/`accepted`/`blocked`), `requested_at`.
- **`posts`**: `id` (UUID PK), `user_id` (FK), `group_id` (nullable FK), `event_id` (nullable FK), `content`, `like_count`, `created_at`.
- **`comments`**: `id` (UUID PK), `post_id` (FK), `user_id` (FK), `parent_comment_id` (nullable self-referencing FK), `mentioned_user_id` (nullable FK), `content`, `like_count`, `created_at`.
- **`likes`**: `id` (UUID PK), `user_id` (FK), `post_id` (nullable FK), `comment_id` (nullable FK), `created_at`. Unique per `(user_id, post_id)` and `(user_id, comment_id)`.

### 3.2 Groups & History
- **`groups`**: `id` (UUID PK), `name`, `description`, `created_by` (FK), `created_at`.
- **`group_members`**: `group_id` (FK PK), `user_id` (FK PK), `role` (`admin`/`member`), `joined_at`.
- **`historical_events`**: `id` (UUID PK), `date` (MM-DD index), `year`, `title`, `description`, `category`, `country`, `source`, `source_url`, `synced_at`.
- **`bookmarks`**: `id` (UUID PK), `user_id` (FK), `event_id` (FK), `created_at`. Unique on `(user_id, event_id)`.

### 3.3 AI Notes & Token Economy
- **`notes`**: `id` (UUID PK), `user_id` (FK), `event_id` (nullable FK), `title`, `content`, `curriculum_tag`, `style` (`standard` or `handwritten`), `source_note_id` (nullable FK), `attachment_name`, `attachment_type`, `is_ai_generated`, `created_at`.
- **`group_shared_notes`**: `group_id` (FK PK), `note_id` (FK PK), `shared_by` (FK), `shared_at`.
- **`user_token_wallets`**: `user_id` (FK PK), `token_balance` (default 350,000), `last_refresh_at`.
- **`token_ledger`**: `id` (UUID PK), `user_id` (FK), `delta` (int), `reason` (`signup_bonus`/`daily_refresh`/`ai_generation`/`purchase`), `balance_after`, `created_at`.
- **`histoin_wallets`**: `user_id` (FK PK), `balance` (int default 0).
- **`histoin_ledger`**: `id` (UUID PK), `user_id` (FK), `delta` (int), `reason` (`quiz_completed`/`daily_login`/`purchase_spend`), `balance_after`, `created_at`.
- **`token_packs`**: `id` (UUID PK), `name`, `token_amount`, `histoin_cost`, `is_active`.

### 3.4 Quizzes
- **`quiz_questions`**: `id` (UUID PK), `event_id` (nullable FK), `topic`, `question`, `options` (JSON list), `correct_answer` (int 0..3), `difficulty`, `created_at`.
- **`quiz_attempts`**: `id` (UUID PK), `user_id` (nullable FK), `session_id`, `question_id` (FK), `selected_option`, `is_correct`, `attempted_at`.

---

## 4. Token Economy & Handwritten Notes Logic

### Token Economy Rules
1. **Signup Bonus**: New registered users automatically receive **350,000 tokens**.
2. **Lazy Daily Refill**: Free quota refills +50,000 tokens every 24 hours up to a cap of `350,000 tokens`. Inactivity across multiple days is back-filled on the next request.
3. **Pre-flight Estimation & Row Locks**: Before generation, estimated tokens are checked against wallet balance. Draining uses `with_for_update()` to prevent concurrent generation race conditions.
4. **Purchased Accumulation**: Tokens bought with Histoins can accumulate up to `1,000,000 tokens`.

### Histoins Earning & Shop
- **Daily Login**: +10 Histoins on first daily activity.
- **Quizzes**: +20 Histoins for correct answers (max 3/day).
- **Packs**: Starter (50K tokens / 100 🪙), Popular (150K tokens / 250 🪙), Mega (350K tokens / 500 🪙).

### Handwritten Notes Style
- Converts formal study notes into student lecture shorthand using abbreviations (`govt`, `b/c`, `w/`), arrows (`→`), and bold underlined highlights.
- Rendered on a lined notebook canvas with red margin rules using Google Fonts `Caveat` and `Patrick Hand`.

---

## 5. Testing & Verification

Automated test suite (`pytest`) verifies all modules with in-memory SQLite:
- `tests/test_auth.py`: User registration, handle tags, authentication, token refresh, duplicate constraints.
- `tests/test_history.py`: Date browser, keyword search, bookmarks CRUD.
- `tests/test_social.py`: Post creation, nested comment threads, like toggling.
- `tests/test_groups.py`: Group lifecycle, member joins, group feed posts.
- `tests/test_ai_notes.py`: AI note synthesis, token deductions, handwritten style, token pack purchase.
- `tests/test_quiz.py`: Question retrieval, quiz attempts, score accuracy, Histoin rewards.
