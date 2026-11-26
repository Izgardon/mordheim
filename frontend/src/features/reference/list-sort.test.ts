import { describe, expect, it, vi } from "vitest";

import { byNumber, listSort } from "./list-sort";

const OPTIONS = [
  { id: "name", label: "Name" },
  { id: "cost", label: "Cost: low to high" },
  { id: "-cost", label: "Cost: high to low" },
] as const;

const params = (sort: string) => ({ get: () => sort, set: vi.fn() });

describe("listSort", () => {
  it("reads ?sort=, the first order by default and left out of the address", () => {
    expect(listSort(params(""), OPTIONS).value).toBe("name");
    expect(listSort(params("rubbish"), OPTIONS).value).toBe("name");
    const sorted = params("-cost");
    const sort = listSort(sorted, OPTIONS);
    expect(sort.value).toBe("-cost");
    sort.menu.onChange("name");
    expect(sorted.set).toHaveBeenCalledWith({ sort: null });
  });

  it("gives a heading its order, then the other way round, as the menu's two orders", () => {
    const byName = params("");
    const cost = listSort(byName, OPTIONS).heading("cost", "-cost");
    expect(cost.direction).toBeNull();
    cost.onSort();
    expect(byName.set).toHaveBeenCalledWith({ sort: "cost" });

    const low = params("cost");
    const lowHeading = listSort(low, OPTIONS).heading("cost", "-cost");
    expect(lowHeading.direction).toBe("asc");
    lowHeading.onSort();
    expect(low.set).toHaveBeenCalledWith({ sort: "-cost" });
    expect(listSort(params("-cost"), OPTIONS).heading("cost", "-cost").direction).toBe("desc");
  });
});

describe("byNumber", () => {
  it("sorts either way, a row with none last both times", () => {
    const rows = [{ n: 2 }, { n: null }, { n: 1 }, { n: 3 }];
    expect([...rows].sort(byNumber((row) => row.n)).map((row) => row.n)).toEqual([1, 2, 3, null]);
    expect([...rows].sort(byNumber((row) => row.n, true)).map((row) => row.n)).toEqual([
      3,
      2,
      1,
      null,
    ]);
  });
});
