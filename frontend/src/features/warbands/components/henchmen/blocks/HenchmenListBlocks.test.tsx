import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandItemMutationResponse } from "@/features/warbands/types/warband-types";
import { makeHenchmenGroup, makeHero } from "@/test/warband-fixtures";

import HenchmenListBlocks from "./HenchmenListBlocks";

const mocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
  useUnitItemMenu: vi.fn(),
}));

vi.mock("../../../api/warbands-events", () => ({ emitWarbandUpdate: mocks.emitWarbandUpdate }));
vi.mock("../../../hooks/useUnitItemMenu", () => ({ default: mocks.useUnitItemMenu }));
vi.mock("../../shared/UnitItemDialogs", () => ({ default: () => null }));

type MutationResult = WarbandItemMutationResponse & { targetUnitType?: string };

describe("HenchmenListBlocks item mutations", () => {
  beforeEach(() => {
    mocks.emitWarbandUpdate.mockReset();
    mocks.useUnitItemMenu.mockReset();
    mocks.useUnitItemMenu.mockReturnValue({ handleMenuToggle: vi.fn() });
  });

  it("only puts henchmen groups into the henchmen list after a move", () => {
    render(<HenchmenListBlocks group={makeHenchmenGroup({ id: 5 })} warbandId={9} canEdit />);
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;
    const source = makeHenchmenGroup({ id: 5 });
    const groupTarget = makeHenchmenGroup({ id: 6 });

    onMutationComplete({ summary: {}, source, target: makeHero({ id: 3 }), targetUnitType: "heroes" });
    onMutationComplete({ summary: {}, source, target: groupTarget, targetUnitType: "henchmen" });

    const ids = (call: number) =>
      mocks.emitWarbandUpdate.mock.calls[call][1].henchmenGroups.map((unit: { id: number }) => unit.id);
    expect(ids(0)).toEqual([5, 5]);
    expect(ids(1)).toEqual([5, 5, 6]);
  });
});
