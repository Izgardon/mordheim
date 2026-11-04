import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";

import { useItemLabel } from "./useItemLabel";

const dagger = { id: 3, name: "Dagger" };

describe("useItemLabel", () => {
  it("reads the list's own name for an item from the sheet, for a unit recruited as that fighter", () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.campaign.warbandSheet(1, 9), {
      item_names: { "tomb-guard": { "3": "Bronze Dagger" } },
    });
    const { result } = renderHook(() => useItemLabel(1, 9), {
      wrapper: createQueryWrapper(client),
    });
    expect(result.current({ fighter_key: "tomb-guard" }, dagger)).toBe("Bronze Dagger (Dagger)");
    expect(result.current({ fighter_key: "liche-priest" }, dagger)).toBe("Dagger");
    expect(result.current({ fighter_key: "" }, dagger)).toBe("Dagger");
  });

  it("reads the item's own name while no sheet is held, and never fetches one", () => {
    const { result } = renderHook(() => useItemLabel(1, 9), { wrapper: createQueryWrapper() });
    expect(result.current({ fighter_key: "tomb-guard" }, dagger)).toBe("Dagger");
  });
});
