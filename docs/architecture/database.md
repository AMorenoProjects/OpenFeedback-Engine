# Database Schema

> Complete documentation of the PostgreSQL schema, RLS policies, and triggers.
> Migration: `supabase/migrations/20260217_init.sql`

---

## 1. Relational Diagram

```
┌──────────────┐
│   projects   │
│──────────────│
│ id (PK)      │
│ name         │
│ hmac_secret  │──────────────────────────────────────────┐
│ created_at   │                                          │
│ updated_at   │                                          │
└──────┬───────┘                                          │
       │ 1:N                                              │
       │                                                  │
┌──────▼───────────┐     ┌──────────────┐     ┌──────────▼──────────┐
│   suggestions    │     │    votes     │     │ pseudonymous_vault  │
│──────────────────│     │──────────────│     │─────────────────────│
│ id (PK)          │◄────│ suggestion_id│     │ id (PK)             │
│ project_id (FK)  │     │ user_hash    │     │ user_hash           │
│ title            │     │ project_id   │     │ encrypted_email     │
│ description      │     │ created_at   │     │ project_id (FK)     │
│ status           │     │──────────────│     │ created_at          │
│ upvotes          │     │ UQ(suggestion│     │─────────────────────│
│ created_at       │     │    _id,      │     │ UQ(project_id,      │
│ updated_at       │     │    user_hash)│     │    user_hash)       │
└──────────────────┘     └──────────────┘     └─────────────────────┘
                              │
                              │ TRIGGER
                              ▼
                    update_suggestion_upvotes()
```

---

## 2. Tables

### 2.1 `projects`

Tenant configuration (the host application integrating OpenFeedback).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Project identifier |
| `name` | `text` | NOT NULL | Descriptive name |
| `hmac_secret` | `text` | NOT NULL | Shared secret for HMAC-SHA256 verification. Never exposed to the browser |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### 2.2 `suggestions`

The public feedback board.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL, `char_length BETWEEN 1 AND 300` | Suggestion title |
| `description` | `text` | `char_length <= 5000` | Optional description |
| `status` | `text` | NOT NULL, default `'open'`, CHECK enum | `open`, `planned`, `in_progress`, `shipped`, `closed` |
| `upvotes` | `integer` | NOT NULL, default `0`, CHECK `>= 0` | Maintained automatically by trigger |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:**
- `idx_suggestions_project` — `(project_id)`
- `idx_suggestions_status` — `(project_id, status)`

### 2.3 `votes`

Public vote ledger. Stores `user_hash`, never the original `user_id`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `suggestion_id` | `uuid` | FK → `suggestions(id)` ON DELETE CASCADE | |
| `user_hash` | `text` | NOT NULL | `HMAC(user_id, project_secret)` — salted per-project |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_vote_per_user (suggestion_id, user_hash)` — one vote per user per suggestion.

**Indexes:**
- `idx_votes_suggestion` — `(suggestion_id)`
- `idx_votes_user_hash` — `(user_hash)`
- `idx_votes_project` — `(project_id)`

### 2.4 `pseudonymous_vault`

Isolated PII (Personally Identifiable Information) store. Separated from `votes` by design.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_hash` | `text` | NOT NULL | Same hash as in `votes` |
| `encrypted_email` | `text` | NOT NULL | Client-side encrypted email |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_vault_per_user (project_id, user_hash)`

**Indexes:**
- `idx_vault_user_hash` — `(user_hash)`
- `idx_vault_project` — `(project_id)`

#### Why a separate table

The separation between `votes` and `pseudonymous_vault` is a deliberate privacy decision:

1. **`votes` is a public ledger** — entails `user_hash` + `suggestion_id`. Anyone can read it.
2. **`pseudonymous_vault` is private** — maps `user_hash` → `encrypted_email` for "just-in-time" notifications.
3. **Benefits of separation:**
   - Stricter access controls (neither `anon` nor `authenticated` can read the vault)
   - Purge all PII with a single `TRUNCATE pseudonymous_vault` without affecting votes
   - Audit PII access independently
4. **The email is encrypted client-side** — even a database dump does not expose plain text emails.

---

## 3. RLS Policies (Row Level Security)

RLS is enabled on all 4 tables. Policies explicitly cover both `anon` and `authenticated`:

### `projects`

| Policy | Role | Operation | Rule | Reason |
|---|---|---|---|---|
| `projects_no_anon_access` | `anon` | ALL | `USING (false)` | The `hmac_secret` must never be readable |
| `projects_no_authenticated_access` | `authenticated` | ALL | `USING (false)` | Only `service_role` manages projects |

### `suggestions`

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `suggestions_public_read` | `anon` | SELECT | `USING (true)` |
| `suggestions_no_anon_write` | `anon` | INSERT | `WITH CHECK (false)` |
| `suggestions_no_anon_update` | `anon` | UPDATE | `USING (false)` |
| `suggestions_no_anon_delete` | `anon` | DELETE | `USING (false)` |
| `suggestions_authenticated_read` | `authenticated` | SELECT | `USING (true)` |
| `suggestions_no_authenticated_write` | `authenticated` | INSERT | `WITH CHECK (false)` |
| `suggestions_no_authenticated_update` | `authenticated` | UPDATE | `USING (false)` |
| `suggestions_no_authenticated_delete` | `authenticated` | DELETE | `USING (false)` |

### `votes`

Same structure as `suggestions`: public read, denied write for both roles.

### `pseudonymous_vault`

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `vault_no_anon_access` | `anon` | ALL | `USING (false)` |
| `vault_no_authenticated_access` | `authenticated` | ALL | `USING (false)` |

**Principle:** Only the `service_role` (used by Edge Functions) can write to any table. Only `suggestions` and `votes` allow public reading.

---

## 4. Triggers

### `update_suggestion_upvotes()`

`SECURITY DEFINER` function that keeps `suggestions.upvotes` synchronized:

| Event | Action |
|---|---|
| `AFTER INSERT ON votes` | `upvotes = upvotes + 1` in the corresponding suggestion |
| `AFTER DELETE ON votes` | `upvotes = greatest(upvotes - 1, 0)` in the corresponding suggestion |

This allows Edge Functions to only `INSERT`/`DELETE` in `votes` — the counter updates automatically.

---

## 5. Extensions

| Extension | Usage |
|---|---|
| `pgcrypto` | `gen_random_uuid()` for PKs |
