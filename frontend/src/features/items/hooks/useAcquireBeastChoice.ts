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
 * Buying a beast (the plan's Acquire mock): a mount or pet bought for a unit is switched on for it
 * straight away unless unticked; a creature bought for the stash is recruited straight away into
 * a group of the same beast (offered first) or a new group, or kept as items.
 */
export function useAcquireBeastChoice({
  item,
  unitType,
  unitLabel,
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
  const who = unitLabel || "The unit";

  const view: AcquireBeastView | null = offersCompanion
    ? {
        kind: "companion",
        label: beast?.kind === "mount" ? `${who} rides it straight away` : `Keep as ${who}'s pet`,
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
