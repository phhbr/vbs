import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionRealtime } from "./realtime";

type Handler = (arg: never) => void;

function createFakeChannel() {
  const broadcastHandlers = new Map<string, Handler>();
  const presenceHandlers = new Map<string, Handler>();
  let subscribeCallback: ((status: string) => void) | undefined;
  let presenceState: Record<string, unknown[]> = {};

  const channel = {
    on: vi.fn(
      (type: string, filter: { event: string }, handler: Handler) => {
        if (type === "broadcast") broadcastHandlers.set(filter.event, handler);
        if (type === "presence") presenceHandlers.set(filter.event, handler);
        return channel;
      },
    ),
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
const { channelSpy, removeChannelSpy, getFakeChannel, resetFakeChannel } =
  vi.hoisted(() => {
    let fakeChannel = createFakeChannel();
    return {
      channelSpy: vi.fn(() => fakeChannel),
      removeChannelSpy: vi.fn(),
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
});

describe("useSessionRealtime", () => {
  it("subscribes to the session's private channel, keyed by participant id", () => {
    renderHook(
      () =>
        useSessionRealtime({
          sessionId: "session-1",
          participantId: "participant-1",
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
        }),
      { wrapper },
    );

    getFakeChannel().emitPresenceSync({
      "participant-1": [{}],
      "participant-2": [{}],
    });

    await waitFor(() =>
      expect([...result.current.onlineParticipantIds].sort()).toEqual([
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
        }),
      { wrapper },
    );

    unmount();

    expect(removeChannelSpy).toHaveBeenCalledWith(getFakeChannel());
  });

  it("does nothing until both a session and a participant id are known", () => {
    renderHook(
      () =>
        useSessionRealtime({ sessionId: undefined, participantId: undefined }),
      { wrapper },
    );

    expect(channelSpy).not.toHaveBeenCalled();
  });
});
