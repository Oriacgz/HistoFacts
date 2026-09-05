# Database Partitioning Strategy & Trigger Policy

## 1. Overview & Current Posture
As of HistoFacts v1.0, database partitioning is **intentionally deferred**. With current dataset sizes (under a few hundred thousand rows across ledger and messaging tables), single-table PostgreSQL architecture provides optimal query performance, straightforward indexing, and lower operational overhead. Premature partitioning would increase query planner complexity and migration maintenance without practical performance gains.

---

## 2. Trigger Criteria
Partitioning must be evaluated and triggered when **either** of the following conditions is met:

1. **Row Count Threshold**:
   - `token_ledger` exceeds **5,000,000 rows**.
   - `histoin_ledger` exceeds **5,000,000 rows**.
   - `messages` exceeds **10,000,000 rows**.

2. **Query Performance Degradation**:
   - 95th percentile query latency on date-filtered range queries (e.g., retrieving recent ledger history or messages within a time window) exceeds **100ms** despite appropriate indexing.
   - Sequential scans or buffer cache thrashing appears in PostgreSQL `pg_stat_statements` or execution plans (`EXPLAIN ANALYZE`).

---

## 3. Recommended Partitioning Approach
When the trigger threshold is crossed, implement **Monthly Range Partitioning** on the `created_at` timestamp column:

- **Partition Key**: `created_at` (TIMESTAMPTZ)
- **Granularity**: Monthly range (e.g., `token_ledger_y2026m09`, `token_ledger_y2026m10`)
- **Automation Tooling**: Utilize **`pg_partman`** (PostgreSQL Partition Manager) rather than hand-rolled DDL:
  - Automates pre-creation of future monthly child tables.
  - Automatically manages retention policies and table detach/drop if archiving cold ledger records to object storage.
  - Transparently routes inserts to active monthly partition without application code changes.

---

## 4. Current Prerequisite: Foundation Indexes
To ensure immediate fast date-range queries and guarantee a frictionless transition to partitioning in the future, standard B-tree indexes are established on the `created_at` column for the high-volume tables:

- `token_ledger (created_at)` (`ix_token_ledger_created_at`)
- `histoin_ledger (created_at)` (`ix_histoin_ledger_created_at`)
- `messages (created_at)` (`ix_messages_created_at`)
