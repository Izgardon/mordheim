import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ITEM_KIND_ICONS, ItemKindIcon } from "@/components/ui/game-icons";

import { itemKind, itemStatsLine, itemSubtype } from "./item-kind";

const dagger = { type: "Weapon", subtype: "Melee", strength: "As user", range: "Close Combat" };
const heavyArmour = { type: "Armour", subtype: "Body Armour", save: "5+", save_bonus: 2 };

describe("itemKind", () => {
  // William, 22 Nov 2026: "Subtype shields should have a shield icon"
  it("gives a shield and a helmet their own kind, and other armour stays armour", () => {
    expect(itemKind({ type: "Armour", subtype: "Shield" })).toBe("shield");
    expect(itemKind({ type: "Armour", subtype: "Helmet" })).toBe("helmet");
    expect(itemKind({ type: "Armour", subtype: "Body Armour" })).toBe("armour");
    expect(itemKind({ type: "Armour", subtype: "Barding" })).toBe("armour");
    expect(itemKind({ type: "Armour", subtype: "" })).toBe("armour");
  });

  // William, 25 Nov 2026: "different icons for mounts, creatures and pets"
  it("tells a mount, a creature and a pet apart, by the beast's kind or the subtype", () => {
    expect(itemKind({ type: "Animal", subtype: "Mount" })).toBe("mount");
    expect(itemKind({ type: "Animal", subtype: "Pet" })).toBe("pet");
    expect(itemKind({ type: "Animal", subtype: "Creature" })).toBe("creature");
    expect(itemKind({ type: "Animal", subtype: "Ridden Animals" })).toBe("mount");
    expect(itemKind({ type: "Animal", subtype: "", beast_kind: "pet" })).toBe("pet");
  });

  it("draws each with its own icon", () => {
    const icons = new Set(Object.values(ITEM_KIND_ICONS));
    expect(icons.size).toBe(Object.keys(ITEM_KIND_ICONS).length);
    const markup = (kind: Parameters<typeof ItemKindIcon>[0]["kind"]) =>
      render(<ItemKindIcon kind={kind} />).container.innerHTML;
    expect(markup("mount")).not.toBe(markup("pet"));
    expect(markup("creature")).not.toBe(markup("mount"));
    expect(markup("helmet")).not.toBe(markup("armour"));
  });
});

describe("itemSubtype", () => {
  // William, 25 Nov 2026: "Items should show their subtype like Armour, shield, helmet, mount, pet"
  it("is a weapon's way of fighting, an animal's kind, armour's piece, else its own", () => {
    expect(itemSubtype(dagger)).toBe("Melee");
    expect(itemSubtype({ type: "Weapon", subtype: "Missile" })).toBe("Ranged");
    expect(itemSubtype({ type: "Weapon", subtype: "Blackpowder" })).toBe("Blackpowder");
    expect(itemSubtype(heavyArmour)).toBe("Armour");
    expect(itemSubtype({ type: "Armour", subtype: "Shield" })).toBe("Shield");
    expect(itemSubtype({ type: "Armour", subtype: "Cloak" })).toBe("Cloak");
    expect(itemSubtype({ type: "Animal", subtype: "Pet" })).toBe("Pet");
    expect(itemSubtype({ type: "Miscellaneous", subtype: "Poisons and Drugs" })).toBe(
      "Poisons and Drugs"
    );
    expect(itemSubtype({ type: "Miscellaneous", subtype: " " })).toBe("Miscellaneous");
  });
});

describe("itemStatsLine", () => {
  // William, 25 Nov 2026: "Why does heavy armour here not explain its armour save rule"
  it("gives armour its save, as printed or else the steps it adds", () => {
    expect(itemStatsLine(heavyArmour)).toBe("Armour · Save 5+");
    expect(itemStatsLine({ type: "Armour", subtype: "Body Armour", save: "", save_bonus: 2 })).toBe(
      "Armour · Save +2"
    );
    expect(
      itemStatsLine({
        type: "Armour",
        subtype: "Barding",
        save: "+1 to existing save",
        save_bonus: 1,
      })
    ).toBe("Barding · Save +1");
    expect(itemStatsLine({ type: "Armour", subtype: "Helmet", save: "" })).toBe("Helmet");
  });

  it("says Melee, Ranged or Blackpowder, a range only off close combat, and Str", () => {
    expect(itemStatsLine(dagger)).toBe("Melee · Str As user");
    expect(itemStatsLine({ type: "Weapon", subtype: "Ranged", range: '24"', strength: "3" })).toBe(
      'Ranged · 24" · Str 3'
    );
    expect(
      itemStatsLine({ type: "Weapon", subtype: "Blackpowder", range: '24"', strength: "4" })
    ).toBe('Blackpowder · 24" · Str 4');
    expect(itemStatsLine({ type: "Weapon", subtype: "Melee", strength: "+1" })).toBe(
      "Melee · Str +1"
    );
  });

  it("names an animal's kind and nothing more", () => {
    expect(itemStatsLine({ type: "Animal", subtype: "Mount", save_bonus: 1 })).toBe("Mount");
    expect(itemStatsLine({ type: "Animal", subtype: "Creature" })).toBe("Creature");
    expect(itemStatsLine({ type: "Animal", subtype: "Pet" })).toBe("Pet");
  });
});
