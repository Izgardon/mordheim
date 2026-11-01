import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNotesAutosave } from "./useNotesAutosave";

describe("useNotesAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves only the latest text, a second after the last keystroke", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotesAutosave(save));

    act(() => result.current.change("Pl"));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.change("Plague"));
    expect(result.current.saveState).toBe("pending");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("Plague");
    expect(result.current.saveState).toBe("saved");
  });

  it("sends what is still waiting when the editor closes", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useNotesAutosave(save));

    act(() => result.current.change("Blessed: +1 to hit"));
    unmount();

    expect(save).toHaveBeenCalledWith("Blessed: +1 to hit");
  });

  it("says when the save failed", async () => {
    const save = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useNotesAutosave(save));

    act(() => result.current.change("Note"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.saveState).toBe("error");
  });
});
