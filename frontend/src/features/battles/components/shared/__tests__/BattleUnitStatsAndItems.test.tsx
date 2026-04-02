import type * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BattleUnitStatsAndItems from "../BattleUnitStatsAndItems";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock("@/features/warbands/components/shared/unit_details/UnitStatsTable", () => ({
  default: ({ stats }: { stats: Record<string, unknown> }) => (
    <div>
      <span>Strength: {String(stats.strength)}</span>
      <span>Wounds: {String(stats.wounds)}</span>
    </div>
  ),
}));

describe("BattleUnitStatsAndItems", () => {
  it("keeps temporary stat overrides and notes visible in read-only mode", () => {
    render(
      <BattleUnitStatsAndItems
        unitKey="hero:1"
        baseStats={{
          movement: 4,
          weapon_skill: 4,
          ballistic_skill: 4,
          strength: 4,
          toughness: 3,
          wounds: 1,
          initiative: 4,
          attacks: 1,
          leadership: 8,
          armour_save: null,
        }}
        override={{
          stats: {
            strength: 5,
            wounds: 2,
          },
        }}
        notes="Scenario wound"
        editable={false}
        isEditing={false}
        onToggleEditing={vi.fn()}
        onUpdateStat={vi.fn()}
        onUpdateNotes={vi.fn()}
        onResetOverride={vi.fn()}
        singleUseItems={[]}
        canUseItems={false}
        onUseItem={vi.fn()}
        getUsedItemCount={() => 0}
        activeItemActionKey={null}
        showItemSection={false}
      />
    );

    expect(screen.getByText("Temp")).toBeInTheDocument();
    expect(screen.getByText("Strength: 5")).toBeInTheDocument();
    expect(screen.getByText("Wounds: 2")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Scenario wound")).toBeInTheDocument();
  });
});
