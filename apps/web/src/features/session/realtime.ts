import type { SessionParticipant } from "@vbs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { sendHeartbeat } from "./api";
import { invalidateSessionData } from "./queries";

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
/** How often a connected client rechecks session_state while someone is
 * missing from socket presence — the only way it learns that a polling
 * participant's heartbeat (which bumps no version) has come or gone. */
export const PRESENCE_GAP_POLL_MS = 10_000;

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
 * cheap request per interval instead of one per query. Each tick also sends a
 * heartbeat(), so that connected clients, which see this one missing from
 * socket presence, can still show it as online through `seen_recently`.
 */
export function useSessionRealtime({
  sessionId,
  participantId,
  version,
  participants,
}: {
  sessionId: string | undefined;
  participantId: string | undefined;
  /** sessions.version as last fetched through session_state. */
  version: number | undefined;
  /** The member list from the same session_state fetch. */
  participants: readonly SessionParticipant[] | null | undefined;
}) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [disconnectedLong, setDisconnectedLong] = useState(false);
  const [presentParticipantIds, setPresentParticipantIds] = useState<
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

    const refetchAll = () => void invalidateSessionData(queryClient);

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
        setPresentParticipantIds(new Set(Object.keys(channel.presenceState())));
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
    if (!sessionId || !participantId || connected) return;

    const tick = () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "session",
      });
      // Best effort: a missed heartbeat only costs a moment of "offline" on
      // other screens, and a real problem (removed, expired) surfaces through
      // the session_state refetch above anyway.
      sendHeartbeat(sessionId).catch(() => undefined);
    };
    const poll = setInterval(tick, POLL_INTERVAL_MS);
    const notice = setTimeout(
      () => setDisconnectedLong(true),
      POLLING_NOTICE_AFTER_MS,
    );
    return () => {
      clearInterval(poll);
      clearTimeout(notice);
      setDisconnectedLong(false);
    };
  }, [sessionId, participantId, connected, queryClient]);

  // Someone in the member list but not in socket presence is either gone or
  // polling — and if polling, only session_state's `seen_recently` says so.
  // Heartbeats bump no version, so nothing would ever prompt that refetch;
  // keep it fresh on a slow timer for as long as the gap exists.
  const someoneMissingFromPresence =
    connected &&
    (participants ?? []).some((p) => !presentParticipantIds.has(p.id));

  useEffect(() => {
    if (!someoneMissingFromPresence) return;
    const poll = setInterval(
      () =>
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "session",
        }),
      PRESENCE_GAP_POLL_MS,
    );
    return () => clearInterval(poll);
  }, [someoneMissingFromPresence, queryClient]);

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
    // Online means present on the socket or recently heard from by
    // heartbeat. Without a socket of our own, neither can be judged — others'
    // presence never reaches us — so null says "unknown" rather than
    // "everyone offline".
    onlineParticipantIds: connected
      ? new Set([
          ...presentParticipantIds,
          ...(participants ?? [])
            .filter((p) => p.seen_recently)
            .map((p) => p.id),
        ])
      : null,
    expired,
  };
}
