import type { Dispatch, SetStateAction } from "react";

import type { UnitStats } from "../../components/shared/unit_details/UnitStatsTable";
import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type UnitLevelUpOptions<K extends UnitKindKey> = {
  unit: Unit<K>;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updated: Unit<K>) => void;
  /** Henchmen only: Lad's Got Talent promoted the group's last member. */
  onGroupRemoved?: (groupId: number) => void;
};

/** State every kind's level-up dialog shares; the kind's advance hook builds on it. */
export type LevelUpCore<K extends UnitKindKey> = UnitLevelUpOptions<K> & {
  kind: UnitKindConfig<K>;
  hasRolled2d6: boolean;
  roll2d6Total: number | null;
  setRoll2d6Total: Dispatch<SetStateAction<number | null>>;
  selectedStat: string | null;
  setSelectedStat: Dispatch<SetStateAction<string | null>>;
  setLevelUpError: Dispatch<SetStateAction<string>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
};

/** Heroes and hired swords: a 1d6 follow-up roll and the Skill/Spell/Special placeholders. */
export type FollowUpAdvance = {
  rollSignal1d6: number;
  canRollSecondDie: boolean;
  triggerRoll1d6: () => void;
  handleRoll1d6Complete: (results: unknown) => void;
  otherOptions: readonly { id: string; label: string }[];
};

/** Henchmen: the 2d6 result and Lad's Got Talent. */
export type LadsGotTalentAdvance = {
  roll2d6Total: number | null;
  hasRolled2d6: boolean;
  checked: boolean;
  setChecked: (checked: boolean) => void;
  shouldPromptReroll: boolean;
  selectedHenchmanId: string;
  setSelectedHenchmanId: (id: string) => void;
  options: { id: string; label: string }[];
};

export type UnitAdvance = {
  handleSelectStat: (statId: string) => void;
  handleRoll2d6Complete: (results: unknown) => void;
  handleLevelUpConfirm: () => Promise<void>;
  /** Henchmen keep Level up disabled until an advance is picked and no re-roll is due. */
  isConfirmBlocked: boolean;
  followUp?: FollowUpAdvance;
  ladsGotTalent?: LadsGotTalentAdvance;
};

export type UnitLevelUpState = Omit<UnitAdvance, "isConfirmBlocked"> & {
  diceColor: string;
  rollSignal2d6: number;
  triggerRoll2d6: () => void;
  selectedStat: string | null;
  statDelta: Partial<Record<string, number>> | undefined;
  unitStats: UnitStats;
  raceStats: UnitStats | null;
  /** The picked stat would pass the race maximum (shown, never blocking: decision 10). */
  raceMaxWarning: string;
  selectableStatSet: ReadonlySet<string>;
  levelUpError: string;
  isSubmitting: boolean;
  isConfirmDisabled: boolean;
};
