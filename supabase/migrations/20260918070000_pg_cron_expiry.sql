-- M5: pg_cron-driven expiry. Every mutating function already refreshes
-- sessions.expires_at (touch_session), so the only thing missing is a sweep
-- that notices when it has passed and tears the session down.
--
-- expire_stale_sessions() is a plain function, not just a cron body, so
-- pgTAP can call it directly instead of waiting on the scheduler.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Broadcasts session_expired on the session's own channel before deleting it,
-- so a client with the tab open switches to the expired screen immediately
-- rather than waiting on the next session_changed round trip (which will
-- never come, since the row about to be deleted is the one that would have
-- carried the version bump). Same broadcast discipline as session_changed:
-- no session data in the payload, just a reason a client can log.
create function expire_stale_sessions() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_session record;
  v_count integer := 0;
begin
  for v_session in select id from public.sessions where expires_at <= now() loop
    perform realtime.send(
      jsonb_build_object('reason', 'expired'),
      'session_expired',
      'session:' || v_session.id::text,
      true
    );
    delete from public.sessions where id = v_session.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Anonymous users who never belonged to a session, or whose only session(s)
-- have long since expired and cascaded their participant rows away, are
-- otherwise immortal — auth.users has no expiry of its own. 7 days after
-- creation with no participant row left is the signal we have; there is no
-- surviving timestamp for "when did they last belong to one," since that
-- row is gone by the time this runs.
create function cleanup_abandoned_anonymous_users() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '7 days'
     and not exists (
       select 1 from public.participants p where p.user_id = u.id
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Internal maintenance, not part of the API surface: cron runs as postgres,
-- and pgTAP tests call these directly as the migration owner.
revoke execute on function expire_stale_sessions() from public, anon, authenticated;
revoke execute on function cleanup_abandoned_anonymous_users() from public, anon, authenticated;

-- rate_limit_events doesn't exist until the M5 rate-limiting migration; its
-- pruning is scheduled there via cron.alter_job rather than referenced here,
-- so this migration stays runnable on its own.
select cron.schedule(
  'expire-stale-sessions',
  '*/15 * * * *',
  $$select public.expire_stale_sessions();$$
);

select cron.schedule(
  'cleanup-abandoned-anonymous-users',
  '0 3 * * *',
  $$select public.cleanup_abandoned_anonymous_users();$$
);
