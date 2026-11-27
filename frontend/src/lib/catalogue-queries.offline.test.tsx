/**
 * Offline looks empty (docs/plans/offline.md): with no connection TanStack pauses a list that never
 * loaded, and a paused query isn't "loading", so the reference pages showed an empty list that
 * looked real. A paused list with nothing to show is loading and says why, and loads by itself
 * when the connection returns.
 */
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/test/query-test-utils";

import { useCatalogue } from "./catalogue-queries";
import { NO_CONNECTION_LIST } from "./query-offline";

const listSkills = vi.hoisted(() => vi.fn());
vi.mock("@/features/skills/api/skills-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/skills/api/skills-api")>()),
  listSkills,
}));

beforeEach(() => {
  listSkills.mockResolvedValue([{ id: 1, name: "Sprint" }]);
  onlineManager.setOnline(false);
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("useCatalogue offline", () => {
  it("is loading and says there is no connection, never an empty list, until it is back", async () => {
    const { result } = renderHook(() => useCatalogue("skills", 7), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current).toMatchObject({ data: [], isLoading: true, error: NO_CONNECTION_LIST });
    expect(listSkills).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));

    await waitFor(() => expect(result.current.data).toEqual([{ id: 1, name: "Sprint" }]));
    expect(result.current).toMatchObject({ isLoading: false, error: "" });
  });

  it("keeps a list it already read on screen while offline", async () => {
    onlineManager.setOnline(true);
    const { result } = renderHook(() => useCatalogue("skills", 7), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    act(() => onlineManager.setOnline(false));
    act(() => {
      void result.current.refetch(); // paused: it waits for the connection
    });

    expect(result.current).toMatchObject({ isLoading: false, error: "" });
    expect(result.current.data).toHaveLength(1);
  });
});
