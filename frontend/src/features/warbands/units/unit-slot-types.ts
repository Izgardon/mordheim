import type { ComponentType } from "react";

import type { Unit, UnitKindKey } from "../types/units";
import type { UnitFormSlotProps } from "../components/units/forms/form-types";

export type CardLayout = "mobile" | "default";

export type SummaryHeaderProps<K extends UnitKindKey> = {
  unit: Unit<K>;
  warbandId: number;
  /** The unit's level from the kind's table and the campaign thresholds. */
  level: number;
  /** `edit`: the hero's Trade badge marks the trading action (BUG-31). */
  canEdit: boolean;
  onUnitUpdated?: (updated: Unit<K>) => void;
};

export type ExpandedTilesProps<K extends UnitKindKey> = {
  unit: Unit<K>;
  warbandId: number;
  layout: CardLayout;
  canEdit: boolean;
  /** Updates the expanded card's copy and reports the change. */
  onUnitUpdated: (updated: Unit<K>) => void;
  /** Reports the change only (the card's update callback). */
  reportUnitUpdated?: (updated: Unit<K>) => void;
};

export type PendingAdvanceDialogsProps<K extends UnitKindKey> = {
  unit: Unit<K>;
  warbandId: number;
  spellOpen: boolean;
  onSpellOpenChange: (open: boolean) => void;
  skillOpen: boolean;
  onSkillOpenChange: (open: boolean) => void;
  onUnitUpdated?: (updated: Unit<K>) => void;
};

/** Card differences that are markup or behaviour (design 0.28 §5.2 slots). */
export type UnitCardSlots<K extends UnitKindKey> = {
  /** Name, level line and the kind's badges on the summary card. */
  SummaryHeader: ComponentType<SummaryHeaderProps<K>>;
  /** The expanded card's heading with its adornment (crown, item warning). */
  ExpandedTitle: ComponentType<{ unit: Unit<K> }>;
  /** The expanded card's tiles: trading action, size, caster, costs, upkeep, blood pact. */
  ExpandedTiles: ComponentType<ExpandedTilesProps<K>>;
  /** "Learn New Skill" / "New Spell" dialogs opened from pending entries. */
  PendingAdvanceDialogs?: ComponentType<PendingAdvanceDialogsProps<K>>;
  /** The edit card's left column above the stats: identity, traits, XP and costs. */
  FormBasics: ComponentType<UnitFormSlotProps<K>>;
  /** The edit card's loadout; heroes and hired swords use the shared UnitLoadout. */
  FormLoadout?: ComponentType<UnitFormSlotProps<K>>;
};
