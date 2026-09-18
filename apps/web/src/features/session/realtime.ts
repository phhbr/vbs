import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export type ConnectionStatus = "connected" | "reconnecting";

type SessionChangedPayload = { version?: unknown };

/**
 * One private channel per session, `session:<id>`. Broadcasts carry only the
 * new sessions.version, never a vote value, so every handler here decides
 * whether to refetch — it never trusts the payload for state itself. A stale
 * or duplicate version is ignored; a fresh SUBSCRIBED after having been
 * connected before triggers an unconditional refetch, since a dropped
 * connection may have missed signals entirely.
 */
export function useSessionRealtime({
  sessionId,
  participantId,
}: {
  sessionId: string | undefined;
  participantId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [onlineParticipantIds, setOnlineParticipantIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!sessionId || !participantId) return;

    let lastVersion = 0;
    let hasConnectedOnce = false;

    const refetchAll = () =>
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "session" || query.queryKey[0] === "round",
      });

    const channel = supabase.channel(`session:${sessionId}`, {
      config: { private: true, presence: { key: participantId } },
    });

    channel
      .on(
        "broadcast",
        { event: "session_changed" },
        ({ payload }: { payload: SessionChangedPayload }) => {
          const version =
            typeof payload.version === "number" ? payload.version : 0;
          if (version <= lastVersion) return;
          lastVersion = version;
          refetchAll();
        },
      )
      .on(
        "broadcast",
        // Distinct from session_changed: the row that would have carried a
        // version bump is the one being deleted, so the sweep broadcasts
        // this explicitly rather than leaving clients to find out from the
        // next VB002 on refetch.
        { event: "session_expired" },
        () => setExpired(true),
      )
      .on("presence", { event: "sync" }, () => {
        setOnlineParticipantIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("connected");
          void channel.track({ online_at: new Date().toISOString() });
          if (hasConnectedOnce) refetchAll();
          hasConnectedOnce = true;
        } else {
          setStatus("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      // Reset on cleanup, not at the top of the next run: a component that
      // switches to a different session should not carry the old session's
      // expired flag into the new one, even for a single render.
      setExpired(false);
    };
  }, [sessionId, participantId, queryClient]);

  return { status, onlineParticipantIds, expired };
}
