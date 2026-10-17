import { beforeEach, describe, expect, it, vi } from "vitest";

import { unitApi } from "./unit-api";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), emitWarbandUpdate: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("../api/warbands-events", () => ({ emitWarbandUpdate: mocks.emitWarbandUpdate }));

describe.each([
  ["hero", "heroes"],
  ["henchmen_group", "henchmen-groups"],
  ["hired_sword", "hired-swords"],
] as const)("unitApi(%s)", (kind, segment) => {
  const base = `/warbands/9/${segment}/`;

  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({ id: 4 });
    mocks.emitWarbandUpdate.mockReset();
  });

  it("reads the list, the detail list, one unit and its kill history", async () => {
    const api = unitApi(kind);

    await api.list(9);
    await api.listDetails(9);
    await api.detail(9, 4);
    await api.killHistory(9, 4);

    expect(mocks.apiRequest.mock.calls).toEqual([
      [base],
      [`${base}detail/`],
      [`${base}4/`],
      [`${base}4/kill-history/`],
    ]);
  });

  it("POSTs, PATCHes, DELETEs and levels up with the same bodies as before", async () => {
    const api = unitApi(kind);

    await api.create(9, { name: "A" } as never);
    await api.update(9, 4, { xp: 3 });
    await api.remove(9, 4);
    await api.levelUp(9, 4, { advance: { id: "WS" } });

    expect(mocks.apiRequest.mock.calls).toEqual([
      [base, { method: "POST", body: { name: "A" } }],
      [`${base}4/`, { method: "PATCH", body: { xp: 3 } }],
      [`${base}4/`, { method: "DELETE" }],
      [`${base}4/level-up/`, { method: "POST", body: { payload: { advance: { id: "WS" } } } }],
    ]);
  });

  it("announces creates and deletes unless told not to", async () => {
    const api = unitApi(kind);

    await api.create(9, {} as never);
    await api.remove(9, 4);
    await api.create(9, {} as never, { emitUpdate: false });
    await api.remove(9, 4, { emitUpdate: false });
    await api.update(9, 4, {});

    expect(mocks.emitWarbandUpdate.mock.calls).toEqual([[9], [9]]);
  });
});
