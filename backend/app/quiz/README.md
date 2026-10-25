# Quiz generation and scoring

Apply migrations through `quiz_user_cache` before running the updated quiz
service. Install the backend requirements, including `pypdf` for PDF extraction.

Personalized sessions start at `POST /api/quiz/personalized/generate` with a
history topic and `easy`, `medium`, or `hard` difficulty. PDF sessions use
`POST /api/quiz/personalized/from-pdf` with multipart `file` and `difficulty`.
Both require authentication and return `session_id` and ten questions without
answer keys. PDF content is validated and parsed on the server, with a 10 MB
upload limit and 4,000-character model context limit.

The configured `LLM_BASE_URL` server must be running with `LLM_MODEL` loaded.
`QUIZ_LLM_BASE_URL` and `QUIZ_LLM_MODEL` optionally override these for quiz requests
only. The model ID must match `/v1/models` exactly. Leave overrides empty to share
the AI Notes model configuration.
Generation has a ten-minute overall deadline to accommodate slow local inference
and reserves extra output tokens for thinking models. The gateway allows 615
seconds for quiz generation routes only. JSON schema constrains the question
count, four choices, and valid answer indices; semantic validation still runs.
Unavailable models return 503, timeouts 504, and invalid output 502. Failed
generation never saves or substitutes static questions. `fallback_questions` is
a deterministic test fixture helper, not a production fallback.
Live lobbies require Redis. With Docker Desktop running, use
`docker compose up -d redis` from the repository root.

Publish each month's official set through
`POST /api/quiz/internal/global/pool`, using the existing internal-service
secret header and JSON `{"period": "2026-10"}`. This is an admin/job operation;
the participant endpoints never generate a pool. Publication is idempotent and
creates all forty questions in one transaction. An unavailable pool returns 503.

`GET /api/quiz/global/current` returns the official set without answer keys.
`POST /api/quiz/global/start` starts or resumes the authenticated user's monthly
session. Every user receives the same ordered question IDs. A completed monthly
session cannot be restarted.

Complete either type at `POST /api/quiz/sessions/{session_id}/complete` with
`{"answers": {"question-id": 0}, "total_time_seconds": 120}`. Null or omitted
answers are unanswered, with no penalty. The server computes scores, history,
and per-question reviews. Repeating completion returns the stored result.
Global completion credits `max(score, 0)` through the existing Histoin wallet
and ledger in the same transaction. Scores themselves may be negative.

Legacy `/generate` and `/session` remain available.
Legacy history submissions are recalculated using stored question answers;
global results require an official session. The legacy question and attempt
endpoints cannot expose official global answer keys. The leaderboard retains
its SQL aggregation/window ranking and batched profile lookup, restricted to
completed global sessions in the current month.

Live lobbies require `REDIS_URL`. Create a room from an owned personalized
session at `POST /api/quiz/lobby/create` with `quiz_session_id`; no new questions
are generated. Connect through `/api/quiz/lobby/{code}/ws` and authenticate in
the initial `join` message. Server actions are `start_quiz`, `submit_answer`,
and `advance_question`. The host moderates and manually closes/advances rounds;
players have twenty seconds to answer. Redis stores the room for one hour and
pub/sub distributes updates across replicas. Missing Redis returns 503.
Completed lobby sessions appear in each player's history and award no Histoins.

History lists completed, owned sessions in one paginated SQL query. Detail
performs an ownership lookup and one joined question/attempt query, preserving
question order and unanswered questions. Legacy records retain their saved
reviews. Generation displays a thinking indicator and elapsed request time,
including PDF extraction; it does not invent percentages. Global checks the
monthly pool on entry and displays a retryable not-ready state for 503.

Quiz regression tests cover generation, scoring, reward idempotency, ownership,
history query counts, Redis concurrency, cross-replica updates, and authenticated
WebSocket actions. `tests/quiz_platform_server.py` and `quiz_redis_fixture.py`
provide a disposable browser-test platform using SQLite, fixture model responses,
and a Redis protocol emulator. Production Redis, PostgreSQL and the deployed local
model must also be verified in the target environment.

`tests/quiz_live_smoke.py` is an opt-in check against the real local gateway,
configured model, Redis and database. It creates temporary test users and quiz
records, exercises generation and live lobby/result flows, then deletes only its
own data. After one model test, `--reuse-model-proof` can use the saved real-model
output to repeat lobby checks without another expensive inference request.

Host ending a lobby: `POST /api/quiz/lobby/{code}/end` (authenticated host only),
or the host WebSocket `end_quiz` action, atomically closes answers and moves all
players to `final_results`. Snapshots include `ended_by_host`, final standings,
and each player's persisted result. Repeated end requests preserve the original
finish time and scores. Reconnecting players receive the same final result;
transport disconnects alone do not end a match. The host's explicit Back to All
Game Modes also ends the room before leaving.

Live early-stop regression: `venv/Scripts/python.exe tests/quiz_live_smoke.py
--reuse-model-proof --end-early`. Set `QUIZ_SMOKE_BASE_URL` to test a separate quiz
service; the default remains the gateway at port 8000.

Generation performance: the model uses compact `q`/`o`/`a` JSON keys and concise
questions/options, normalized to the existing public response. Invalid batches
keep valid, distinct questions within that request and generate only the missing
replacements with a proportional output budget. No cross-request question cache
or static fallback is used. Logs record inference time, attempt count, token
usage, and validation/parsing retries; local model speed still sets the baseline.
