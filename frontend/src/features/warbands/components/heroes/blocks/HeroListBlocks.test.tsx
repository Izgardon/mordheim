import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandItemMutationResponse } from "@/features/warbands/types/warband-types";
import { makeHenchmenGroup, makeHero, makeStashItem } from "@/test/warband-fixtures";

import HeroListBlocks from "./HeroListBlocks";

const mocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
  useUnitItemMenu: vi.fn(),
}));

vi.mock("../../../api/warbands-events", () => ({ emitWarbandUpdate: mocks.emitWarbandUpdate }));
vi.mock("../../../hooks/useUnitItemMenu", () => ({ default: mocks.useUnitItemMenu }));
vi.mock("../../shared/UnitItemDialogs", () => ({ default: () => null }));

type MutationResult = WarbandItemMutationResponse & { targetUnitType?: string };

const renderAndCaptureMutationHandler = () => {
  render(<HeroListBlocks hero={makeHero({ id: 3 })} warbandId={9} canEdit />);
  const options = mocks.useUnitItemMenu.mock.calls[0][0];
  return options.onMutationComplete as (result: MutationResult) => void;
};

describe("HeroListBlocks item mutations", () => {
  beforeEach(() => {
    mocks.emitWarbandUpdate.mockReset();
    mocks.useUnitItemMenu.mockReset();
    mocks.useUnitItemMenu.mockReturnValue({ handleMenuToggle: vi.fn() });
  });

  it("does not put a henchmen group that received a moved item into the heroes list", () => {
    const onMutationComplete = renderAndCaptureMutationHandler();
    const source = makeHero({ id: 3 });
    const target = makeHenchmenGroup({ id: 5 });

    onMutationComplete({ summary: {}, source, target, targetUnitType: "henchmen" });

    const detail = mocks.emitWarbandUpdate.mock.calls[0][1];
    expect(detail.heroes.map((unit: { id: number }) => unit.id)).toEqual([3, 3]);
    expect(detail.heroes).not.toContain(target);
  });

  it("keeps a hero target and drops a stash target", () => {
    const onMutationComplete = renderAndCaptureMutationHandler();
    const source = makeHero({ id: 3 });
    const heroTarget = makeHero({ id: 4 });

    onMutationComplete({ summary: {}, source, target: heroTarget, targetUnitType: "heroes" });
    onMutationComplete({ summary: {}, source, target: makeStashItem(), targetUnitType: "stash" });

    expect(mocks.emitWarbandUpdate.mock.calls[0][1].heroes).toContain(heroTarget);
    expect(
      mocks.emitWarbandUpdate.mock.calls[1][1].heroes.map((unit: { id: number }) => unit.id)
    ).toEqual([3, 3]);
  });
});
