-- M2: session code format and generation, nickname rules, and the
-- "exactly one admin per session" invariant.

create extension if not exists pgcrypto with schema extensions;

-- Session codes are 12 characters from an alphabet without the pairs that get
-- misread out loud or in a screenshot: no I/1, no O/0.
alter table sessions
  add constraint sessions_code_format
  check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$');

-- Nicknames: 1-24 characters, and unique per session case-insensitively so a
-- list never shows both "Anna" and "anna".
alter table participants
  add constraint participants_name_length
  check (char_length(name) between 1 and 24);

create unique index participants_unique_name_per_session
  on participants (session_id, lower(name));

-- At most one admin per session. A partial unique index is what makes this
-- safe under concurrency: two simultaneous promotions are serialised by the
-- index itself, which a count-based check could never do because it cannot see
-- another transaction's uncommitted row. Unique indexes cannot be deferred, so
-- every role swap must demote before it promotes.
create unique index participants_one_admin_per_session
  on participants (session_id) where role = 'admin';

-- At least one admin, whenever the session has participants at all. Deferred to
-- commit time so a demote/promote pair inside one transaction is judged on its
-- end state rather than on the moment in between.
create function assert_session_has_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  -- NEW is not assigned in a DELETE trigger, so this cannot be a coalesce.
  v_session_id uuid := case
    when tg_op = 'DELETE' then old.session_id else new.session_id
  end;
  v_total integer;
  v_admins integer;
begin
  select count(*), count(*) filter (where role = 'admin')
    into v_total, v_admins
    from public.participants
   where session_id = v_session_id;

  if v_total > 0 and v_admins <> 1 then
    raise exception 'session % must have exactly one admin, found %',
      v_session_id, v_admins
      using errcode = 'VB010';
  end if;

  return null;
end;
$$;

create constraint trigger participants_admin_invariant
  after insert or update or delete on participants
  deferrable initially deferred
  for each row execute function assert_session_has_admin();

-- Unbiased because the alphabet has 32 symbols and 256 / 32 is exact.
create function generate_session_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(
    substr(
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      (get_byte(b.bytes, i) % 32) + 1,
      1
    ),
    ''
  )
  from (select extensions.gen_random_bytes(12) as bytes) b,
       generate_series(0, 11) as i;
$$;

-- Accepts what a human might paste or retype — lower case, spaces, the dashes
-- we use for display — and returns the canonical stored form.
create function normalize_session_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;
