-- M3: schema for live voting. Adds the session's current-round pointer, the
-- attempt/result columns on rounds, and the one policy that opens up votes.

-- Idle when null. Set by start_story/re_estimate, cleared by new_story.
alter table sessions
  add column current_round_id uuid references rounds (id) on delete set null;

-- round_number stays the session-wide sequence (what the footer's "Round: N"
-- shows); attempt is scoped to one story and resets to 1 on a new one.
alter table rounds
  add column attempt integer not null default 1 check (attempt >= 1),
  add column result jsonb;

-- The one predicate that decides vote visibility: your own row always, other
-- rows only once the round is revealed. Security definer for the same reason
-- as is_active_session_member — the alternative would have to query votes
-- itself to decide, or rounds/participants under a policy that must also
-- allow it, and keeping it as one function keeps that decision in one place.
create function can_read_vote(p_round_id uuid, p_participant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    exists (
      select 1 from public.participants
      where id = p_participant_id and user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.rounds r
      where r.id = p_round_id
        and r.status = 'revealed'
        and public.is_active_session_member(r.session_id)
    );
$$;

create policy votes_read_own_or_revealed on votes
  for select using (can_read_vote(round_id, participant_id));
