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
    };
  }, [sessionId, participantId, queryClient]);

  return { status, onlineParticipantIds };
}
