/**
 * A pet with a profile fights as its own model (the bestiary rewrite, step 5): the kill dialog
 * offers it as a target and the melee and ranged helpers as a unit, under "Pets". The option
 * builders listed it, but each dialog grouped its options by a section list without "Pets" and so
 * dropped it.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ActiveKillDialog from "./ActiveKillDialog";
import ActiveMeleeDialog from "./ActiveMeleeDialog";
import ActiveRangedDialog from "./ActiveRangedDialog";

const stats = {
  movement: 6,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 2,
  toughness: 2,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 5,
  armour_save: null,
};

const helperOption = (label: string, sectionLabel: string) => ({
  value: label,
  label,
  stats,
  defaultWeaponSkill: 3,
  defaultBallisticSkill: 3,
  sectionLabel,
});

const pickerGroup = (name: string) => {
  const option = screen.getByRole("option", { name });
  return option.closest("optgroup")?.getAttribute("label");
};

describe("pet models in the battle pickers", () => {
  it("are a kill target under Pets", () => {
    render(
      <ActiveKillDialog
        open
        onOpenChange={vi.fn()}
        killerName="Bertram"
        killerUnitKey="hero:4"
        options={[
          {
            unitKey: "hero:1",
            displayName: "Aldric",
            label: "Aldric (Ostland)",
            unitType: "Captain",
            warbandName: "Ostland",
            participantUserId: 1,
            sectionLabel: "Heroes",
          },
          {
            unitKey: "pet:hero:5",
            displayName: "Ferret",
            label: "Ferret (Ostland)",
            unitType: "Pet",
            warbandName: "Ostland",
            participantUserId: 1,
            sectionLabel: "Pets",
          },
        ]}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(pickerGroup("Ferret (Ostland)")).toBe("Pets");
  });

  it("are a unit of the melee helper under Pets, on either side", () => {
    render(
      <ActiveMeleeDialog
        open
        onOpenChange={vi.fn()}
        yourUnitOptions={[
          helperOption("Aldric (Ostland)", "Heroes"),
          helperOption("Ferret (Ostland)", "Pets"),
        ]}
        enemyUnitOptions={[helperOption("Hawk (Hammers)", "Pets")]}
      />
    );

    expect(pickerGroup("Ferret (Ostland)")).toBe("Pets");
    expect(pickerGroup("Hawk (Hammers)")).toBe("Pets");
  });

  it("are a unit of the ranged helper under Pets", () => {
    render(
      <ActiveRangedDialog
        open
        onOpenChange={vi.fn()}
        yourUnitOptions={[
          helperOption("Aldric (Ostland)", "Heroes"),
          helperOption("Ferret (Ostland)", "Pets"),
        ]}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("option", { name: "Ferret (Ostland)" })).toBeInTheDocument();
    expect(pickerGroup("Ferret (Ostland)")).toBe("Pets");
  });
});
