import { useState } from "react";

import { beastOf } from "../utils/item-listing";
import {
  defaultRecruitChoice,
  groupsOfBeast,
  recruitTarget,
  type RecruitChoice,
} from "@/features/warbands/components/units/beasts/RecruitTargetPicker";

import type { Item } from "../types/item-types";
import type { UnitTypeOption } from "@components/unit-selection-section";
import type { HenchmenGroup } from "@/features/warbands/types/warband-types";

type UseAcquireBeastChoiceOptions = {
  item: Item;
  unitType: UnitTypeOption | "";
  /** The receiving unit's name, as the picker shows it. */
  unitLabel: string;
  /** How many copies are bought (the box's wording follows it). */
  quantity: number;
  /** The warband's henchmen groups (a creature joins one of the same beast). */
  groups: HenchmenGroup[];
  /** Queued for a roster Save: a Save's lines can't recruit. */
  deferCommit: boolean;
};

/** The extra choice a beast's purchase offers, as the dialog shows it (null: none). */
export type AcquireBeastView =
  | { kind: "companion"; label: string; checked: boolean; onChange: (checked: boolean) => void }
  | {
      kind: "recruit";
      groups: HenchmenGroup[];
      value: RecruitChoice;
      onChange: (choice: RecruitChoice) => void;
      name: string;
      onNameChange: (name: string) => void;
      defaultName: string;
    };

/**
 * The companion box's words: a group's name takes a plural verb ("Outriders ride them straight
 * away", "Outriders keep it as a pet"), and several copies are "them" (or "pets"). Before a unit
 * is picked (`unitLabel` empty) it is one unit: "The unit rides it…", "Keep as the unit's pet".
 */
export function companionLabel(
  kind: "mount" | "pet",
  unitLabel: string,
  { group, quantity }: { group: boolean; quantity: number }
) {
  const several = quantity > 1;
  const it = several ? "them" : "it";
  const plural = group && unitLabel !== "";
  if (kind === "mount") {
    return `${unitLabel || "The unit"} ${plural ? "ride" : "rides"} ${it} straight away`;
  }
  if (plural) return `${unitLabel} keep ${it} as ${several ? "pets" : "a pet"}`;
  return `Keep as ${unitLabel || "the unit"}'s ${several ? "pets" : "pet"}`;
}

/**
 * Buying a beast (the plan's Acquire mock): a mount or pet bought for a unit is switched on for it
 * straight away unless unticked; a creature bought for the stash is recruited straight away into
 * a group of the same beast (offered first) or a new group, or kept as items.
 */
export function useAcquireBeastChoice({
  item,
  unitType,
  unitLabel,
  quantity,
  groups,
  deferCommit,
}: UseAcquireBeastChoiceOptions) {
  const [companion, setCompanion] = useState(true);
  const [picked, setPicked] = useState<RecruitChoice | null>(null);
  const [name, setName] = useState("");
  const beast = beastOf(item);
  const forUnit = unitType !== "" && unitType !== "stash";
  const offersCompanion = forUnit && (beast?.kind === "mount" || beast?.kind === "pet");
  const offersRecruit = unitType === "stash" && beast?.kind === "creature" && !deferCommit;
  const sameBeast = offersRecruit ? groupsOfBeast(groups, beast?.id) : [];
  const choice = picked ?? defaultRecruitChoice(sameBeast);

  const view: AcquireBeastView | null = offersCompanion
    ? {
        kind: "companion",
        label: companionLabel(beast?.kind === "mount" ? "mount" : "pet", unitLabel, {
          group: unitType === "henchmen",
          quantity,
        }),
        checked: companion,
        onChange: setCompanion,
      }
    : offersRecruit
      ? {
          kind: "recruit",
          groups: sameBeast,
          value: choice,
          onChange: setPicked,
          name,
          onNameChange: setName,
          defaultName: beast?.name ?? item.name,
        }
      : null;

  return {
    view,
    /** An unsold beast (its beast's "Available in the shop" is off): buying it warns. */
    unlisted: beast !== null && item.listed === false,
    /** What the purchase sends for it: `companion` (a line's), `recruit` (POST purchases/ only). */
    companion: offersCompanion && companion,
    recruit: offersRecruit ? recruitTarget(choice, name) : null,
    reset: () => {
      setCompanion(true);
      setPicked(null);
      setName("");
    },
  };
}
