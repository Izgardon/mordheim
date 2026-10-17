import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandItemMutationResponse } from "@/features/warbands/types/warband-types";
import { makeHenchmenGroup, makeHiredSword } from "@/test/warband-fixtures";

import HiredSwordListBlocks from "./HiredSwordListBlocks";

const mocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
  useUnitItemMenu: vi.fn(),
}));

vi.mock("../../../api/warbands-events", () => ({ emitWarbandUpdate: mocks.emitWarbandUpdate }));
vi.mock("../../../hooks/useUnitItemMenu", () => ({ default: mocks.useUnitItemMenu }));
vi.mock("../../shared/UnitItemDialogs", () => ({ default: () => null }));

type MutationResult = WarbandItemMutationResponse & { targetUnitType?: string };

describe("HiredSwordListBlocks item mutations", () => {
  beforeEach(() => {
    mocks.emitWarbandUpdate.mockReset();
    mocks.useUnitItemMenu.mockReset();
    mocks.useUnitItemMenu.mockReturnValue({ handleMenuToggle: vi.fn() });
  });

  it("only puts hired swords into the hired swords list after a move", () => {
    render(<HiredSwordListBlocks hiredSword={makeHiredSword({ id: 7 })} warbandId={9} canEdit />);
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;
    const source = makeHiredSword({ id: 7 });
    const hiredSwordTarget = makeHiredSword({ id: 8 });

    onMutationComplete({
      summary: {},
      source,
      target: makeHenchmenGroup({ id: 5 }),
      targetUnitType: "henchmen",
    });
    onMutationComplete({
      summary: {},
      source,
      target: hiredSwordTarget,
      targetUnitType: "hiredswords",
    });

    const ids = (call: number) =>
      mocks.emitWarbandUpdate.mock.calls[call][1].hiredSwords.map(
        (unit: { id: number }) => unit.id
      );
    expect(ids(0)).toEqual([7, 7]);
    expect(ids(1)).toEqual([7, 7, 8]);
  });

  it("leaves the receiving kind's list stale after a cross-kind move (BUG-86, pinned; flips in PR C)", () => {
    render(<HiredSwordListBlocks hiredSword={makeHiredSword({ id: 7 })} warbandId={9} canEdit />);
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;

    onMutationComplete({
      summary: {},
      source: makeHiredSword({ id: 7 }),
      target: makeHenchmenGroup({ id: 5 }),
      targetUnitType: "henchmen",
    });

    const detail = mocks.emitWarbandUpdate.mock.calls[0][1];
    expect(detail).toHaveProperty("hiredSwords");
    expect(detail).not.toHaveProperty("henchmenGroups");
    expect(detail).not.toHaveProperty("heroes");
  });

  it("reports a hired sword that received the item to onHiredSwordUpdated", () => {
    const onHiredSwordUpdated = vi.fn();
    render(
      <HiredSwordListBlocks
        hiredSword={makeHiredSword({ id: 7 })}
        warbandId={9}
        canEdit
        onHiredSwordUpdated={onHiredSwordUpdated}
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;
    const target = makeHiredSword({ id: 8 });

    onMutationComplete({
      summary: {},
      source: makeHiredSword({ id: 7 }),
      target,
      targetUnitType: "hiredswords",
    });

    expect(onHiredSwordUpdated).toHaveBeenCalledWith(target);
  });
});
