import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandItemMutationResponse } from "@/features/warbands/types/warband-types";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { henchmenKind } from "@/features/warbands/units/kinds/henchmen";
import { hiredSwordKind } from "@/features/warbands/units/kinds/hired-sword";
import {
  makeHenchmenGroup,
  makeHero,
  makeHiredSword,
  makeStashItem,
} from "@/test/warband-fixtures";

import UnitListBlocks from "./UnitListBlocks";

const mocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
  useUnitItemMenu: vi.fn(),
}));

vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => mocks.emitWarbandUpdate,
}));
vi.mock("../../hooks/useUnitItemMenu", () => ({ default: mocks.useUnitItemMenu }));
vi.mock("../shared/UnitItemDialogs", () => ({ default: () => null }));

type MutationResult = WarbandItemMutationResponse & { targetUnitType?: string };

const renderAndCaptureMutationHandler = () => {
  render(<UnitListBlocks kind={heroKind} unit={makeHero({ id: 3 })} warbandId={9} canEdit />);
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

  it("refreshes the receiving kind's list after a cross-kind move (BUG-86)", () => {
    const onMutationComplete = renderAndCaptureMutationHandler();

    const target = makeHenchmenGroup({ id: 5 });
    onMutationComplete({
      summary: {},
      source: makeHero({ id: 3 }),
      target,
      targetUnitType: "henchmen",
    });

    const detail = mocks.emitWarbandUpdate.mock.calls[0][1];
    expect(detail.heroes.map((unit: { id: number }) => unit.id)).toEqual([3, 3]);
    expect(detail.henchmenGroups).toEqual([target]);
    expect(detail).not.toHaveProperty("hiredSwords");
  });

  it("reports a hero that received the item to onHeroUpdated", () => {
    const onHeroUpdated = vi.fn();
    render(
      <UnitListBlocks
        kind={heroKind}
        unit={makeHero({ id: 3 })}
        warbandId={9}
        canEdit
        onUnitUpdated={onHeroUpdated}
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;
    const target = makeHero({ id: 4 });

    onMutationComplete({
      summary: {},
      source: makeHero({ id: 3 }),
      target,
      targetUnitType: "heroes",
    });

    expect(onHeroUpdated).toHaveBeenCalledWith(target);
  });
});

describe("HenchmenListBlocks item mutations", () => {
  beforeEach(() => {
    mocks.emitWarbandUpdate.mockReset();
    mocks.useUnitItemMenu.mockReset();
    mocks.useUnitItemMenu.mockReturnValue({ handleMenuToggle: vi.fn() });
  });

  it("only puts henchmen groups into the henchmen list after a move", () => {
    render(
      <UnitListBlocks
        kind={henchmenKind}
        unit={makeHenchmenGroup({ id: 5 })}
        warbandId={9}
        canEdit
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;
    const source = makeHenchmenGroup({ id: 5 });
    const groupTarget = makeHenchmenGroup({ id: 6 });

    onMutationComplete({
      summary: {},
      source,
      target: makeHero({ id: 3 }),
      targetUnitType: "heroes",
    });
    onMutationComplete({ summary: {}, source, target: groupTarget, targetUnitType: "henchmen" });

    const ids = (call: number) =>
      mocks.emitWarbandUpdate.mock.calls[call][1].henchmenGroups.map(
        (unit: { id: number }) => unit.id
      );
    expect(ids(0)).toEqual([5, 5]);
    expect(ids(1)).toEqual([5, 5, 6]);
  });

  it("refreshes the receiving kind's list after a cross-kind move (BUG-86)", () => {
    render(
      <UnitListBlocks
        kind={henchmenKind}
        unit={makeHenchmenGroup({ id: 5 })}
        warbandId={9}
        canEdit
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;

    const target = makeHero({ id: 3 });
    onMutationComplete({
      summary: {},
      source: makeHenchmenGroup({ id: 5 }),
      target,
      targetUnitType: "heroes",
    });

    const detail = mocks.emitWarbandUpdate.mock.calls[0][1];
    expect(detail.henchmenGroups.map((unit: { id: number }) => unit.id)).toEqual([5, 5]);
    expect(detail.heroes).toEqual([target]);
    expect(detail).not.toHaveProperty("hiredSwords");
  });

  it("does not report a group that received the item to onGroupUpdated (heroes and hired swords do)", () => {
    const onGroupUpdated = vi.fn();
    render(
      <UnitListBlocks
        kind={henchmenKind}
        unit={makeHenchmenGroup({ id: 5 })}
        warbandId={9}
        canEdit
        onUnitUpdated={onGroupUpdated}
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;

    onMutationComplete({
      summary: {},
      source: makeHenchmenGroup({ id: 5 }),
      target: makeHenchmenGroup({ id: 6 }),
      targetUnitType: "henchmen",
    });

    expect(onGroupUpdated).not.toHaveBeenCalled();
  });
});

describe("HiredSwordListBlocks item mutations", () => {
  beforeEach(() => {
    mocks.emitWarbandUpdate.mockReset();
    mocks.useUnitItemMenu.mockReset();
    mocks.useUnitItemMenu.mockReturnValue({ handleMenuToggle: vi.fn() });
  });

  it("only puts hired swords into the hired swords list after a move", () => {
    render(
      <UnitListBlocks
        kind={hiredSwordKind}
        unit={makeHiredSword({ id: 7 })}
        warbandId={9}
        canEdit
      />
    );
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

  it("refreshes the receiving kind's list after a cross-kind move (BUG-86)", () => {
    render(
      <UnitListBlocks
        kind={hiredSwordKind}
        unit={makeHiredSword({ id: 7 })}
        warbandId={9}
        canEdit
      />
    );
    const onMutationComplete = mocks.useUnitItemMenu.mock.calls[0][0].onMutationComplete as (
      result: MutationResult
    ) => void;

    const target = makeHenchmenGroup({ id: 5 });
    onMutationComplete({
      summary: {},
      source: makeHiredSword({ id: 7 }),
      target,
      targetUnitType: "henchmen",
    });
    onMutationComplete({
      summary: {},
      source: makeHiredSword({ id: 7 }),
      target: makeStashItem(),
      targetUnitType: "stash",
    });

    const detail = mocks.emitWarbandUpdate.mock.calls[0][1];
    expect(detail.hiredSwords.map((unit: { id: number }) => unit.id)).toEqual([7, 7]);
    expect(detail.henchmenGroups).toEqual([target]);
    expect(detail).not.toHaveProperty("heroes");
    const toStash = mocks.emitWarbandUpdate.mock.calls[1][1];
    expect(toStash).not.toHaveProperty("henchmenGroups");
    expect(toStash).not.toHaveProperty("heroes");
  });

  it("reports a hired sword that received the item to onHiredSwordUpdated", () => {
    const onHiredSwordUpdated = vi.fn();
    render(
      <UnitListBlocks
        kind={hiredSwordKind}
        unit={makeHiredSword({ id: 7 })}
        warbandId={9}
        canEdit
        onUnitUpdated={onHiredSwordUpdated}
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
