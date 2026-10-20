import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "@/test/query-test-utils";
import { updateCachedList } from "./campaign-queries";

const KEY = ["campaign", 1, "bulletin"];

describe("updateCachedList", () => {
  it("applies the update to the cached list", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(KEY, [{ id: 1 }, { id: 2 }]);

    updateCachedList<{ id: number }>(queryClient, KEY, (entries) =>
      entries.filter((entry) => entry.id !== 1)
    );

    expect(queryClient.getQueryData(KEY)).toEqual([{ id: 2 }]);
  });

  it("leaves a list that was never read uncached, so its first read still happens", () => {
    const queryClient = createTestQueryClient();

    updateCachedList<{ id: number }>(queryClient, KEY, (entries) => [...entries, { id: 3 }]);

    expect(queryClient.getQueryData(KEY)).toBeUndefined();
  });
});
