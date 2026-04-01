import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@components/checkbox", () => ({
  Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="checkbox" {...props} />
  ),
}));

vi.mock("@components/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@components/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => <div data-disabled={disabled ? "true" : "false"}>{children}</div>,
}));

vi.mock("@/components/dice/DiceRoller", () => ({
  default: ({
    rollDisabled,
  }: {
    rollDisabled?: boolean;
  }) => <button disabled={rollDisabled}>Roll 2d6</button>,
}));

import RaritySection from "./RaritySection";

describe("RaritySection", () => {
  it("shows spent heroes and preserves the stored roll display", () => {
    render(
      <RaritySection
        rarity={9}
        heroes={[
          { id: 1, name: "Spent Hero", trading_action: false },
          { id: 2, name: "Fresh Hero", trading_action: true },
        ]}
        searchingHeroId="1"
        onSearchingHeroChange={vi.fn()}
        rollDisabled
        isSavingRarityRoll={false}
        hasStoredRarityRoll
        currentRarityRoll={{ total: 7, modifier: 1, finalTotal: 8, success: false }}
        modifierEnabled
        onModifierEnabledChange={vi.fn()}
        rarityModifier={1}
        onRarityModifierChange={vi.fn()}
        modifierReason="Library"
        onModifierReasonChange={vi.fn()}
        onRarityRollTotalChange={vi.fn()}
      />
    );

    expect(screen.getByText("Spent Hero")).toBeInTheDocument();
    expect(screen.getByText("(spent)")).toBeInTheDocument();
    expect(screen.getByText("Rolled 7 + 1 = 8")).toBeInTheDocument();
    expect(screen.getByText("(Failed)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll 2d6" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("disables rolling when no searchable hero is selected but keeps modifier controls editable", () => {
    render(
      <RaritySection
        rarity={9}
        heroes={[{ id: 2, name: "Fresh Hero", trading_action: true }]}
        searchingHeroId=""
        onSearchingHeroChange={vi.fn()}
        rollDisabled
        isSavingRarityRoll={false}
        hasStoredRarityRoll={false}
        currentRarityRoll={null}
        modifierEnabled={false}
        onModifierEnabledChange={vi.fn()}
        rarityModifier={0}
        onRarityModifierChange={vi.fn()}
        modifierReason=""
        onModifierReasonChange={vi.fn()}
        onRarityRollTotalChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Roll 2d6" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).not.toBeDisabled();
  });

  it("locks modifier controls while a rarity roll is being saved", () => {
    render(
      <RaritySection
        rarity={9}
        heroes={[{ id: 2, name: "Fresh Hero", trading_action: true }]}
        searchingHeroId="2"
        onSearchingHeroChange={vi.fn()}
        rollDisabled
        isSavingRarityRoll
        hasStoredRarityRoll={false}
        currentRarityRoll={null}
        modifierEnabled
        onModifierEnabledChange={vi.fn()}
        rarityModifier={2}
        onRarityModifierChange={vi.fn()}
        modifierReason="Market"
        onModifierReasonChange={vi.fn()}
        onRarityRollTotalChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Roll 2d6" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
