-- ============================================================================
-- Nonce cleanup: automatic purge of expired nonces
-- ============================================================================
-- The used_nonces table grows without bound as every signed request inserts
-- a row. Since nonces only need to be valid within the timestamp tolerance
-- window (5 minutes), rows older than 1 hour are safely purgeable.
--
-- This migration:
--   1. Adds an index on created_at for efficient range deletes.
--   2. Creates a cleanup function.
--   3. Schedules it via pg_cron to run every hour.
-- ============================================================================

-- 1. Index for efficient range-based deletion
create index if not exists idx_used_nonces_created_at
  on used_nonces(created_at);

-- 2. Cleanup function: delete nonces older than 1 hour
--    (generous margin over the 5-minute tolerance window)
create or replace function purge_expired_nonces()
returns void
language plpgsql
security definer
as $$
begin
  delete from used_nonces
  where created_at < now() - interval '1 hour';
end;
$$;

-- 3. Schedule with pg_cron (requires the extension to be enabled in Supabase)
--    Supabase enables pg_cron by default on paid plans.
--    On free tier, users can run this manually or via an external cron.
do $$
begin
  -- Only schedule if pg_cron is available
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-expired-nonces',
      '0 * * * *',  -- Every hour at minute 0
      $cron$select purge_expired_nonces()$cron$
    );
  end if;
end;
$$;
