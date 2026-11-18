import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import GearSheet from "./GearSheet";

const unit = {
  key: "hero:2",
  id: 2,
  kind: "hero",
  displayName: "Black Fang",
  unitType: "Assassin",
  stats: {},
  items: [{ id: 31, name: "Holy Water", count: 1, singleUse: true }],
  singleUseItems: [{ id: 31, name: "Holy Water", quantity: 1 }],
  skills: [],
  spells: [],
  specials: [],
} as unknown as PrebattleUnit;

function renderSheet(canAct: boolean) {
  const onUse = vi.fn();
  renderWithQueryClient(
    <GearSheet
      campaignId={1}
      target={{ unit, tab: "gear" }}
      canAct={canAct}
      usedCount={() => 0}
      busyKey={null}
      onOpenChange={vi.fn()}
      onUse={onUse}
      onUndoUse={vi.fn()}
    />
  );
  return { onUse };
}

describe("GearSheet", () => {
  it("offers Use for a single-use item while the player can act", async () => {
    const user = setupUser();
    const { onUse } = renderSheet(true);

    await user.click(screen.getByRole("button", { name: /Holy Water/ }));
    await user.click(screen.getByRole("button", { name: "Use" }));

    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ key: "hero:2" }), 31);
  });

  it("offers no Use when it cannot act, as another warband's unit opens it", async () => {
    const user = setupUser();
    renderSheet(false);

    await user.click(screen.getByRole("button", { name: /Holy Water/ }));

    expect(screen.getByText(/once per battle/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use" })).toBeNull();
  });
});
