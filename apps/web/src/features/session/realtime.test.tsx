import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionParticipant } from "@vbs/core";
import {
  POLL_INTERVAL_MS,
  POLLING_NOTICE_AFTER_MS,
  PRESENCE_GAP_POLL_MS,
  useSessionRealtime,
} from "./realtime";

type Handler = (arg: never) => void;

function createFakeChannel() {
  const broadcastHandlers = new Map<string, Handler>();
  const presenceHandlers = new Map<string, Handler>();
  let subscribeCallback: ((status: string) => void) | undefined;
  let presenceState: Record<string, unknown[]> = {};

  const channel = {
    on: vi.fn((type: string, filter: { event: string }, handler: Handler) => {
      if (type === "broadcast") broadcastHandlers.set(filter.event, handler);
      if (type === "presence") presenceHandlers.set(filter.event, handler);
      return channel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      subscribeCallback = callback;
      return channel;
    }),
    track: vi.fn(() => Promise.resolve("ok")),
    presenceState: vi.fn(() => presenceState),
    emitBroadcast(event: string, payload: Record<string, unknown>) {
      broadcastHandlers.get(event)?.({ payload } as never);
    },
    emitPresenceSync(state: Record<string, unknown[]>) {
      presenceState = state;
      presenceHandlers.get("sync")?.(undefined as never);
    },
    emitStatus(status: string) {
      subscribeCallback?.(status);
    },
  };
  return channel;
}

// vi.mock is hoisted above every other statement in this file, so the mock
// factory cannot close over a plain top-level variable — it would run before
// that variable is initialized. vi.hoisted runs alongside it instead.
const {
  channelSpy,
  removeChannelSpy,
  rpcSpy,
  getFakeChannel,
  resetFakeChannel,
} = vi.hoisted(() => {
  let fakeChannel = createFakeChannel();
  return {
    channelSpy: vi.fn(() => fakeChannel),
    removeChannelSpy: vi.fn(),
    rpcSpy: vi.fn(() => Promise.resolve({ data: null, error: null })),
    getFakeChannel: () => fakeChannel,
    resetFakeChannel: () => {
      fakeChannel = createFakeChannel();
    },
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    channel: channelSpy,
    removeChannel: removeChannelSpy,
    rpc: rpcSpy,
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  resetFakeChannel();
  channelSpy.mockClear();
  removeChannelSpy.mockClear();
  rpcSpy.mockClear();
});

describe("useSessionRealtime", () => {
  it("subscribes to the session's private channel, keyed by participant id", () => {
    renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    expect(channelSpy).toHaveBeenCalledWith("session:session-1", {
      config: { private: true, presence: { key: "participant-1" } },
    });
  });

  it("reports reconnecting until the channel is subscribed", () => {
    const { result } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    expect(result.current.status).toBe("reconnecting");
  });

  it("reports connected and starts tracking presence once subscribed", async () => {
    const { result } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    getFakeChannel().emitStatus("SUBSCRIBED");

    await waitFor(() => expect(result.current.status).toBe("connected"));
    expect(getFakeChannel().track).toHaveBeenCalled();
  });

  it("falls back to reconnecting on a channel error after having connected", async () => {
    const { result } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    getFakeChannel().emitStatus("SUBSCRIBED");
    await waitFor(() => expect(result.current.status).toBe("connected"));

    getFakeChannel().emitStatus("CHANNEL_ERROR");
    await waitFor(() => expect(result.current.status).toBe("reconnecting"));
  });

  it("collects online participant ids from presence sync", async () => {
    const { result } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    getFakeChannel().emitStatus("SUBSCRIBED");
    getFakeChannel().emitPresenceSync({
      "participant-1": [{}],
      "participant-2": [{}],
    });

    await waitFor(() =>
      expect([...(result.current.onlineParticipantIds ?? [])].sort()).toEqual([
        "participant-1",
        "participant-2",
      ]),
    );
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    unmount();

    expect(removeChannelSpy).toHaveBeenCalledWith(getFakeChannel());
  });

  it("reports expired on a session_expired broadcast", async () => {
    const { result } = renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version: 1,
          participants: undefined,
        }),
      { wrapper },
    );

    expect(result.current.expired).toBe(false);

    getFakeChannel().emitBroadcast("session_expired", { reason: "expired" });

    await waitFor(() => expect(result.current.expired).toBe(true));
  });

  it("does nothing until both a session and a participant id are known", () => {
    renderHook(
      () =>
        useSessionRealtime({
          sessionId: undefined,
          participantId: undefined,
          version: undefined,
          participants: undefined,
        }),
      { wrapper },
    );

    expect(channelSpy).not.toHaveBeenCalled();
  });
});

type InvalidateFilters = {
  predicate: (query: { queryKey: unknown[] }) => boolean;
};

/** Which of the hook's query families a set of invalidate calls touched. */
function invalidatedFamilies(spy: ReturnType<typeof vi.spyOn>) {
  const families = new Set<string>();
  for (const [filters] of spy.mock.calls as [InvalidateFilters][]) {
    if (filters.predicate({ queryKey: ["session", "CODE"] }))
      families.add("session");
    if (filters.predicate({ queryKey: ["round", "round-1"] }))
      families.add("round");
  }
  return families;
}

describe("useSessionRealtime without a socket", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  type Props = {
    version: number;
    participants?: readonly SessionParticipant[];
  };

  function renderRealtime(version = 1, participants?: SessionParticipant[]) {
    return renderHook(
      ({ version, participants }: Props) =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
          version,
          participants,
        }),
      {
        initialProps: { version, participants } as Props,
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      },
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls only session_state while disconnected, and stops once subscribed", () => {
    renderRealtime();

    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS));
    expect(invalidatedFamilies(invalidateSpy)).toEqual(new Set(["session"]));

    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    invalidateSpy.mockClear();
    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS * 3));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("resumes polling when an established connection drops", () => {
    renderRealtime();
    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    act(() => getFakeChannel().emitStatus("CHANNEL_ERROR"));
    invalidateSpy.mockClear();

    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS));
    expect(invalidatedFamilies(invalidateSpy)).toEqual(new Set(["session"]));
  });

  it("reports polling once the socket has stayed away long enough", () => {
    const { result } = renderRealtime();

    act(() => vi.advanceTimersByTime(POLLING_NOTICE_AFTER_MS - 1));
    expect(result.current.status).toBe("reconnecting");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("polling");

    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    expect(result.current.status).toBe("connected");
  });

  it("refetches the round queries when session_state's version moves", () => {
    const { rerender } = renderRealtime(1);
    // The first version is only a baseline: nothing to catch up on yet.
    expect(invalidateSpy).not.toHaveBeenCalled();

    rerender({ version: 2 });
    expect(invalidatedFamilies(invalidateSpy)).toEqual(new Set(["round"]));
  });

  it("skips a broadcast for a version session_state already delivered", () => {
    const { rerender } = renderRealtime(1);
    rerender({ version: 2 });
    invalidateSpy.mockClear();

    act(() =>
      getFakeChannel().emitBroadcast("session_changed", { version: 2 }),
    );
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() =>
      getFakeChannel().emitBroadcast("session_changed", { version: 3 }),
    );
    expect(invalidatedFamilies(invalidateSpy)).toEqual(
      new Set(["session", "round"]),
    );
  });

  it("refetches session_state when the tab becomes visible again", () => {
    renderRealtime();
    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    invalidateSpy.mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(invalidatedFamilies(invalidateSpy)).toEqual(new Set(["session"]));
  });

  it("reports presence as unknown rather than empty while disconnected", () => {
    const { result } = renderRealtime();
    expect(result.current.onlineParticipantIds).toBeNull();

    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    expect(result.current.onlineParticipantIds).toEqual(new Set());
  });

  it("sends a heartbeat with every poll tick, and none once connected", () => {
    renderRealtime();

    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS * 2));
    expect(rpcSpy).toHaveBeenCalledTimes(2);
    expect(rpcSpy).toHaveBeenCalledWith("heartbeat", {
      p_session_id: "session-1",
    });

    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    rpcSpy.mockClear();
    act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS * 3));
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

function participant(id: string, seen_recently = false): SessionParticipant {
  return {
    id,
    name: id,
    role: "player",
    can_vote: true,
    is_you: false,
    seen_recently,
  };
}

describe("useSessionRealtime with a participant who is polling", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  function renderConnected(participants: SessionParticipant[]) {
    const hook = renderHook(
      ({ participants }: { participants: SessionParticipant[] }) =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "me",
          version: 1,
          participants,
        }),
      {
        initialProps: { participants },
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      },
    );
    act(() => getFakeChannel().emitStatus("SUBSCRIBED"));
    act(() => getFakeChannel().emitPresenceSync({ me: [{}] }));
    invalidateSpy.mockClear();
    return hook;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts someone seen by heartbeat as online, though absent from presence", () => {
    const { result } = renderConnected([
      participant("me"),
      participant("polling-bob", true),
      participant("gone-cy", false),
    ]);

    expect([...(result.current.onlineParticipantIds ?? [])].sort()).toEqual([
      "me",
      "polling-bob",
    ]);
  });

  it("rechecks session_state while someone is missing from presence", () => {
    renderConnected([participant("me"), participant("polling-bob", true)]);

    act(() => vi.advanceTimersByTime(PRESENCE_GAP_POLL_MS));
    expect(invalidatedFamilies(invalidateSpy)).toEqual(new Set(["session"]));
  });

  it("does not recheck when everyone is present on the socket", () => {
    renderConnected([participant("me")]);

    act(() => vi.advanceTimersByTime(PRESENCE_GAP_POLL_MS * 3));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
