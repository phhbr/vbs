import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * `polling` is `reconnecting` that has lasted long enough to say so: the
 * socket has not come back within POLLING_NOTICE_AFTER_MS, so the screen is
 * being kept current by polling alone. The usual cause is a network that
 * blocks WebSockets outright — a corporate proxy with a "Block WebSockets"
 * rule lets every plain HTTPS request through, so the app loads and works,
 * but no broadcast ever arrives.
 */
export type ConnectionStatus = "connected" | "reconnecting" | "polling";

export const POLL_INTERVAL_MS = 4_000;
export const POLLING_NOTICE_AFTER_MS = 10_000;

type SessionChangedPayload = { version?: unknown };

/**
 * One private channel per session, `session:<id>`. Broadcasts carry only the
 * new sessions.version, never a vote value, so every handler here decides
 * whether to refetch — it never trusts the payload for state itself. A stale
 * or duplicate version is ignored; a fresh SUBSCRIBED after having been
 * connected before triggers an unconditional refetch, since a dropped
 * connection may have missed signals entirely.
 *
 * Without a socket, the same version drives a polling fallback: only
 * session_state is refetched on a timer, and the round queries follow when
 * its version moves — exactly what a broadcast would have triggered, at one
 * cheap request per interval instead of one per query.
 */
export function useSessionRealtime({
  sessionId,
  participantId,
  version,
}: {
  sessionId: string | undefined;
  participantId: string | undefined;
  /** sessions.version as last fetched through session_state. */
  version: number | undefined;
}) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [disconnectedLong, setDisconnectedLong] = useState(false);
  const [onlineParticipantIds, setOnlineParticipantIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [expired, setExpired] = useState(false);
  // The highest version whose changes the round queries already reflect —
  // shared by the broadcast handler and the session_state observer below, so
  // whichever learns of a version first refetches and the other skips it.
  const handledVersionRef = useRef<number | undefined>(undefined);

  const active = !!sessionId && !!participantId;

  useEffect(() => {
    if (!sessionId || !participantId) return;

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
          if (version <= (handledVersionRef.current ?? 0)) return;
          handledVersionRef.current = version;
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
          setConnected(true);
          void channel.track({ online_at: new Date().toISOString() });
          if (hasConnectedOnce) refetchAll();
          hasConnectedOnce = true;
        } else {
          setConnected(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      // Reset on cleanup, not at the top of the next run: a component that
      // switches to a different session should not carry the old session's
      // expired flag or versions into the new one, even for a single render.
      setExpired(false);
      setConnected(false);
      handledVersionRef.current = undefined;
    };
  }, [sessionId, participantId, queryClient]);

  // Polling fallback: while the socket is down, refetch session_state on a
  // timer. Only that one query — the version observer below pulls in the
  // round queries when, and only when, something actually changed.
  useEffect(() => {
    if (!active || connected) return;

    const refetchSession = () =>
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "session",
      });
    const poll = setInterval(refetchSession, POLL_INTERVAL_MS);
    const notice = setTimeout(
      () => setDisconnectedLong(true),
      POLLING_NOTICE_AFTER_MS,
    );
    return () => {
      clearInterval(poll);
      clearTimeout(notice);
      setDisconnectedLong(false);
    };
  }, [active, connected, queryClient]);

  // A tab coming back to the foreground may have slept through broadcasts
  // (browsers throttle background timers, heartbeats included) or through
  // poll ticks. One session_state refetch settles it either way.
  useEffect(() => {
    if (!active) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "session",
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [active, queryClient]);

  // The first version seen is only a baseline — the round queries are being
  // fetched for it right now anyway. Any later, higher one means session_state
  // learned of a change before (or instead of) a broadcast.
  useEffect(() => {
    if (!active || version === undefined) return;
    const handled = handledVersionRef.current;
    if (handled !== undefined && version <= handled) return;
    handledVersionRef.current = version;
    if (handled === undefined) return;
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "round",
    });
  }, [active, version, queryClient]);

  const status: ConnectionStatus = connected
    ? "connected"
    : disconnectedLong
      ? "polling"
      : "reconnecting";

  return {
    status,
    // Presence travels over the same socket, so without it nobody's online
    // state is known — null says "unknown" rather than "everyone offline".
    onlineParticipantIds: connected ? onlineParticipantIds : null,
    expired,
  };
}
