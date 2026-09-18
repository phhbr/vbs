-- Fixes a bug from the M3 realtime migration: clients could subscribe to
-- their session's channel (the SELECT policy) but every presence track()
-- call was silently rejected, because presence is client-published and
-- publishing is an insert on realtime.messages, which had no policy at
-- all. Broadcasts never needed this — broadcast_session_version() runs as
-- the function owner via realtime.send(), not through a client insert —
-- but presence has no server-side equivalent; the client's own browser is
-- the only thing that ever calls track().
--
-- Scoped to extension = 'presence' specifically, so this does not also
-- reopen the door to clients sending arbitrary broadcasts, which is still
-- exclusively the trigger's job.
create policy session_channel_presence_insert on realtime.messages
  for insert
  with check (extension = 'presence' and is_session_channel_member(topic));
