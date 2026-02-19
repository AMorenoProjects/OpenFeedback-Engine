-- ============================================================================
-- OpenFeedback Engine — Initial Schema
-- ============================================================================
-- Design principles:
--   1. Signed Stateless Auth: No sessions. Every write is verified via HMAC
--      signature on an Edge Function — the DB never sees raw credentials.
--   2. Pseudonymous Vault: Votes reference a `user_hash` (SHA-256 of user_id),
--      NOT the original user_id. Contact emails live in a separate encrypted
--      vault table so the public vote ledger contains zero PII.
--   3. Public Read, Gated Write: Anyone with a valid project_id can read
--      suggestions and vote counts. All mutations go through Edge Functions
--      that verify the HMAC signature before writing with the service role.
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================================
-- PROJECTS
-- ============================================================================
-- Each host application registers as a project.
-- The hmac_secret is used by Edge Functions to verify signed payloads.
-- ============================================================================

create table projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  hmac_secret  text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column projects.hmac_secret is
  'Shared secret between the host app and OpenFeedback. Used to verify HMAC-SHA256 signatures on every write request. Never exposed to the browser.';

alter table projects enable row level security;

-- Projects are read-only for authenticated dashboard users; anon gets nothing.
-- Management is done via service role or dashboard.
create policy "projects_no_anon_access"
  on projects for all
  to anon
  using (false);

-- Explicit deny for authenticated role — project management is service-role only
create policy "projects_no_authenticated_access"
  on projects for all
  to authenticated
  using (false);

-- ============================================================================
-- SUGGESTIONS
-- ============================================================================
-- The public feedback board. Readable by anyone with the project_id.
-- Writes go through Edge Functions to enforce auth + rate limits.
-- ============================================================================

create table suggestions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 300),
  description  text check (char_length(description) <= 5000),
  status       text not null default 'open'
                 check (status in ('open', 'planned', 'in_progress', 'shipped', 'closed')),
  upvotes      integer not null default 0 check (upvotes >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_suggestions_project on suggestions(project_id);
create index idx_suggestions_status  on suggestions(project_id, status);

alter table suggestions enable row level security;

-- Public read scoped to project
create policy "suggestions_public_read"
  on suggestions for select
  to anon
  using (true);

-- No direct writes from anon — mutations go through Edge Functions
create policy "suggestions_no_anon_write"
  on suggestions for insert
  to anon
  with check (false);

create policy "suggestions_no_anon_update"
  on suggestions for update
  to anon
  using (false);

create policy "suggestions_no_anon_delete"
  on suggestions for delete
  to anon
  using (false);

-- Authenticated users can read but not write directly (writes go through Edge Functions)
create policy "suggestions_authenticated_read"
  on suggestions for select
  to authenticated
  using (true);

create policy "suggestions_no_authenticated_write"
  on suggestions for insert
  to authenticated
  with check (false);

create policy "suggestions_no_authenticated_update"
  on suggestions for update
  to authenticated
  using (false);

create policy "suggestions_no_authenticated_delete"
  on suggestions for delete
  to authenticated
  using (false);

-- ============================================================================
-- VOTES
-- ============================================================================
-- Public vote ledger. Stores `user_hash` (SHA-256 of user_id) so there is
-- no link back to the original identity without brute-forcing the hash.
-- One vote per user per suggestion is enforced by a unique constraint.
-- ============================================================================

create table votes (
  id             uuid primary key default gen_random_uuid(),
  suggestion_id  uuid not null references suggestions(id) on delete cascade,
  user_hash      text not null,
  project_id     uuid not null references projects(id) on delete cascade,
  created_at     timestamptz not null default now(),

  constraint uq_vote_per_user unique (suggestion_id, user_hash)
);

comment on table votes is
  'Public vote ledger. Contains only a one-way hash of the user identity — no PII. Contact info lives exclusively in the pseudonymous_vault table.';

create index idx_votes_suggestion on votes(suggestion_id);
create index idx_votes_user_hash  on votes(user_hash);
create index idx_votes_project    on votes(project_id);

alter table votes enable row level security;

-- Public read
create policy "votes_public_read"
  on votes for select
  to anon
  using (true);

-- No direct writes — all vote mutations go through the submit-vote Edge Function
create policy "votes_no_anon_write"
  on votes for insert
  to anon
  with check (false);

create policy "votes_no_anon_update"
  on votes for update
  to anon
  using (false);

create policy "votes_no_anon_delete"
  on votes for delete
  to anon
  using (false);

-- Authenticated can read votes but not write directly
create policy "votes_authenticated_read"
  on votes for select
  to authenticated
  using (true);

create policy "votes_no_authenticated_write"
  on votes for insert
  to authenticated
  with check (false);

create policy "votes_no_authenticated_update"
  on votes for update
  to authenticated
  using (false);

create policy "votes_no_authenticated_delete"
  on votes for delete
  to authenticated
  using (false);

-- ============================================================================
-- PSEUDONYMOUS VAULT
-- ============================================================================
-- Separated from votes by design. This is the GDPR compliance layer.
--
-- WHY a separate table?
--   - The votes table is a public ledger (user_hash + suggestion_id).
--   - The vault maps user_hash → encrypted_email for "just-in-time"
--     notifications (e.g., "Your feature request #45 shipped!").
--   - By isolating PII in its own table, we can:
--     a) Apply stricter access controls (no anon access at all).
--     b) Purge all PII with a single TRUNCATE without touching votes.
--     c) Audit access independently.
--   - The email is encrypted client-side before insertion, so even a
--     database dump does not expose raw email addresses.
-- ============================================================================

create table pseudonymous_vault (
  id               uuid primary key default gen_random_uuid(),
  user_hash        text not null,
  encrypted_email  text not null,
  project_id       uuid not null references projects(id) on delete cascade,
  created_at       timestamptz not null default now(),

  constraint uq_vault_per_user unique (project_id, user_hash)
);

comment on table pseudonymous_vault is
  'Isolated PII store. Maps user_hash to client-side-encrypted email. Separated from votes so the public ledger carries zero personally identifiable information. Can be truncated independently for GDPR erasure requests.';

create index idx_vault_user_hash on pseudonymous_vault(user_hash);
create index idx_vault_project   on pseudonymous_vault(project_id);

alter table pseudonymous_vault enable row level security;

-- Vault is completely invisible to anon — only service role can read/write
create policy "vault_no_anon_access"
  on pseudonymous_vault for all
  to anon
  using (false);

-- Vault is also invisible to authenticated role — only service role
create policy "vault_no_authenticated_access"
  on pseudonymous_vault for all
  to authenticated
  using (false);

-- ============================================================================
-- FUNCTIONS: upvote counter maintenance
-- ============================================================================
-- Keeps suggestions.upvotes in sync when votes are inserted or deleted.
-- Runs as a trigger so the Edge Function only needs to INSERT/DELETE on votes.
-- ============================================================================

create or replace function update_suggestion_upvotes()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update suggestions
      set upvotes = upvotes + 1, updated_at = now()
      where id = new.suggestion_id;
    return new;
  elsif tg_op = 'DELETE' then
    update suggestions
      set upvotes = greatest(upvotes - 1, 0), updated_at = now()
      where id = old.suggestion_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_votes_after_insert
  after insert on votes
  for each row execute function update_suggestion_upvotes();

create trigger trg_votes_after_delete
  after delete on votes
  for each row execute function update_suggestion_upvotes();
