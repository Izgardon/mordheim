import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChannel } from "./use-channel";

const { subscribe, unsubscribe } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return { unsubscribe, subscribe: vi.fn((..._args: unknown[]) => unsubscribe) };
});

vi.mock("./client", () => ({ subscribe, onConnectionRestored: vi.fn(() => () => undefined) }));

type Props = { channel: string | null; handler: (data: unknown) => void };

describe("useChannel", () => {
  beforeEach(() => {
    subscribe.mockClear();
    unsubscribe.mockClear();
  });

  it("keeps one subscription while the handler changes, and calls the latest handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ channel, handler }: Props) => useChannel(channel, "e", handler),
      {
        initialProps: { channel: "private-a", handler: first },
      }
    );

    rerender({ channel: "private-a", handler: second });
    const dispatch = subscribe.mock.calls[0][2] as (data: unknown) => void;
    dispatch({ id: 1 });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ id: 1 });
  });

  it("resubscribes when the channel changes and subscribes to nothing for null", () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ channel }: Props) => useChannel(channel, "e", handler),
      { initialProps: { channel: "private-a", handler } }
    );

    rerender({ channel: "private-b", handler });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenLastCalledWith("private-b", "e", expect.any(Function));

    rerender({ channel: null, handler });
    unmount();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
