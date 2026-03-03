-- ============================================================================
-- OpenFeedback Engine — Starter SQL (copy & paste into Supabase SQL Editor)
-- ============================================================================
-- This single script creates the full database schema for OpenFeedback Engine.
-- Run it once on a fresh Supabase project and you're ready to go.
--
-- Design principles:
--   1. Signed Stateless Auth: No sessions. Every write is verified via HMAC
--      signature on an Edge Function — the DB never sees raw credentials.
--   2. Pseudonymous Vault: Votes reference a `user_hash` (HMAC of user_id),
--      NOT the original user_id. Contact emails live in a separate encrypted
--      vault table so the public vote ledger contains zero PII.
--   3. Public Read, Gated Write: Anyone can read suggestions and vote counts.
--      All mutations go through Edge Functions that verify the HMAC signature
--      before writing with the service role.
-- ============================================================================

-- 0. Required extension
create extension if not exists "pgcrypto";


-- ============================================================================
-- 1. Projects table
-- ============================================================================
-- Each host application registers as a project (tenant).
-- The hmac_secret is used by Edge Functions to verify signed payloads.

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  hmac_secret  text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column projects.hmac_secret is
  'Shared secret between the host app and OpenFeedback. Used to verify HMAC-SHA256 signatures on every write request. Never exposed to the browser.';

alter table projects enable row level security;

-- No public access — management is service-role only (or via dashboard with project_members)
create policy "projects_no_anon_access"
  on projects for all
  to anon
  using (false);


-- ============================================================================
-- 2. Project Members table (dashboard multi-tenant access)
-- ============================================================================
-- Links Supabase Auth users to projects they can manage via the dashboard.

create table if not exists project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner'
                check (role in ('owner', 'admin', 'viewer')),
  created_at  timestamptz not null default now(),

  constraint uq_project_member unique (project_id, user_id)
);

create index idx_project_members_user    on project_members(user_id);
create index idx_project_members_project on project_members(project_id);

alter table project_members enable row level security;

-- Authenticated users can see their own memberships
create policy "members_select_own"
  on project_members for select
  to authenticated
  using (user_id = auth.uid());

-- No anon access
create policy "members_no_anon"
  on project_members for all
  to anon
  using (false);

-- Dashboard users can read projects they belong to
create policy "projects_authenticated_read_own"
  on projects for select
  to authenticated
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
    )
  );

-- Authenticated users cannot write projects directly (service-role only)
create policy "projects_no_authenticated_insert"
  on projects for insert
  to authenticated
  with check (false);

create policy "projects_no_authenticated_update"
  on projects for update
  to authenticated
  using (false);

create policy "projects_no_authenticated_delete"
  on projects for delete
  to authenticated
  using (false);


-- ============================================================================
-- 3. Suggestions table
-- ============================================================================
-- The public feedback board. Readable by anyone.
-- Writes go through Edge Functions to enforce auth + rate limits.

create table if not exists suggestions (
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

-- Public read for anon (SDK consumers)
create policy "suggestions_public_read"
  on suggestions for select
  to anon
  using (true);

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

-- Authenticated dashboard users can read all suggestions
create policy "suggestions_authenticated_read"
  on suggestions for select
  to authenticated
  using (true);

-- No direct inserts from authenticated (Edge Functions handle this)
create policy "suggestions_no_authenticated_write"
  on suggestions for insert
  to authenticated
  with check (false);

-- Dashboard admins (owner/admin) can update suggestions in their projects
create policy "suggestions_authenticated_update_own"
  on suggestions for update
  to authenticated
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = suggestions.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

-- Dashboard admins can delete suggestions in their projects
create policy "suggestions_authenticated_delete_own"
  on suggestions for delete
  to authenticated
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = suggestions.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );


-- ============================================================================
-- 4. Votes table
-- ============================================================================
-- Public vote ledger. Stores `user_hash` (HMAC of user_id) — no PII.
-- One vote per user per suggestion enforced by unique constraint.

create table if not exists votes (
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

-- Authenticated can read but not write directly
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
-- 5. Pseudonymous Vault (GDPR compliance layer)
-- ============================================================================
-- Separated from votes by design. Maps user_hash → encrypted_email for
-- just-in-time notifications. Email is encrypted client-side before insertion.
-- Completely invisible to anon and authenticated — service-role only.

create table if not exists pseudonymous_vault (
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

-- Completely locked — only service role can read/write
create policy "vault_no_anon_access"
  on pseudonymous_vault for all
  to anon
  using (false);

create policy "vault_no_authenticated_access"
  on pseudonymous_vault for all
  to authenticated
  using (false);


-- ============================================================================
-- 6. Used Nonces table (replay attack prevention)
-- ============================================================================
-- Edge Functions check this table to reject replayed signed payloads.
-- No RLS policies = implicit deny for anon/authenticated. Service role bypasses RLS.

create table if not exists used_nonces (
  project_id  uuid not null references projects(id) on delete cascade,
  nonce       text not null,
  created_at  timestamptz not null default now(),
  primary key (project_id, nonce)
);

alter table used_nonces enable row level security;
-- No policies needed: RLS enabled with no policies = deny all for anon/authenticated.
-- Service role (used by Edge Functions) bypasses RLS automatically.


-- ============================================================================
-- 7. Webhooks table (event notifications)
-- ============================================================================
-- Allows projects to register webhook URLs for events like suggestion.created.

create table if not exists webhooks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  url         text not null,
  events      text[] not null default '{suggestion.created, suggestion.shipped}',
  secret      text default null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table webhooks enable row level security;

-- Dashboard users can view webhooks for their projects
create policy "webhooks_authenticated_read"
  on webhooks for select
  to authenticated
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = webhooks.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Dashboard admins can manage webhooks for their projects
create policy "webhooks_authenticated_manage"
  on webhooks for all
  to authenticated
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = webhooks.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );


-- ============================================================================
-- 8. Trigger: auto-maintain suggestions.upvotes count
-- ============================================================================
-- Increments/decrements the counter when votes are inserted/deleted.
-- Runs as SECURITY DEFINER so it can update suggestions regardless of RLS.

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


-- ============================================================================
-- Done! Your OpenFeedback Engine database is ready.
-- Next steps:
--   1. Deploy the Edge Functions (submit-vote, submit-suggestion)
--   2. Install the SDK: npm install @openfeedback/react @openfeedback/client
--   3. Set up HMAC signing in your server-side code
-- ============================================================================
