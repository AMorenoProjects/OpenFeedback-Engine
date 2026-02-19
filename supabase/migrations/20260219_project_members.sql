-- ============================================================================
-- OpenFeedback Engine — Project Members (Dashboard Admin Access)
-- ============================================================================
-- Enables multi-tenant dashboard access. Each admin user is linked to their
-- projects via project_members. RLS policies on projects and suggestions are
-- updated so authenticated dashboard users can manage their own data.
-- ============================================================================

-- ============================================================================
-- PROJECT_MEMBERS
-- ============================================================================

create table project_members (
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

-- ============================================================================
-- PROJECTS — update RLS for dashboard admin read access
-- ============================================================================

-- Drop the blanket deny for authenticated role
drop policy "projects_no_authenticated_access" on projects;

-- Authenticated dashboard users can read projects they are members of
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

-- Authenticated users still cannot write directly (writes go through server actions with service role)
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
-- SUGGESTIONS — update RLS for dashboard admin moderation
-- ============================================================================

-- Drop existing deny policies for authenticated writes
drop policy "suggestions_no_authenticated_update" on suggestions;
drop policy "suggestions_no_authenticated_delete" on suggestions;

-- Dashboard admins (owner/admin role) can update suggestions in their projects
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
