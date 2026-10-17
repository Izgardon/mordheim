import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { UnitTypeOption } from "@components/unit-selection-section";

import type { HeroFormEntry, HenchmenGroupFormEntry } from "../../../types/warband-types";
import type { PendingPurchase } from "../../../utils/pending-purchases";
import type { UnitValidationError, UnitValidationField } from "../../../units/unit-form-helpers";
import type { UnitForm, UnitKindKey } from "../../../types/units";

/** The fields every unit form shares (henchmen forms have no caster, skill access or spells). */
export type UnitFormBase = Pick<
  HenchmenGroupFormEntry,
  | "id"
  | "name"
  | "unit_type"
  | "race_id"
  | "race_name"
  | "race"
  | "stats"
  | "xp"
  | "level_up"
  | "price"
  | "armour_save"
  | "deeds"
  | "large"
  | "half_rate"
  | "items"
  | "skills"
  | "specials"
>;

/** Hero and hired-sword forms: the base plus caster, skill access, spells and the hero flags. */
export type CasterUnitForm = HeroFormEntry & {
  upkeep_price?: string;
  rating?: string;
  blood_pacted?: boolean;
  no_level_ups?: boolean;
};

export type PendingPurchaseRemoval = {
  unitType: UnitTypeOption;
  unitId: string;
  itemId: number;
};

/** The catalogue lists and callbacks every edit card needs. */
export type UnitFormCatalogue = {
  campaignId: number;
  availableRaces: Race[];
  availableItems: Item[];
  availableSkills: Skill[];
  /** Henchmen have no spells. */
  availableSpells?: Spell[];
  availableSpecials: Special[];
  canAddCustom?: boolean;
  onRaceCreated: (race: Race) => void;
};

/** What the kind's form slots receive from UnitFormCard. */
export type UnitFormSlotProps<K extends UnitKindKey> = UnitFormCatalogue & {
  form: UnitForm<K>;
  index: number;
  inputClassName: string;
  onUpdate: (index: number, updater: (form: UnitForm<K>) => UnitForm<K>) => void;
  onRemove: (index: number) => void;
  onSetLeader?: (index: number, isLeader: boolean) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  deferItemCommit: boolean;
  reservedGold: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: PendingPurchaseRemoval) => void;
  error: UnitValidationError | null;
  /** The server's messages for this form after a refused Save (UX-05). */
  serverErrors?: string[];
  /** A recruit queued until Save: what Save will charge for it. */
  recruitCost?: number;
  /** Queue a copy of this unit (ROST-NEW-01). */
  onDuplicate?: () => void;
  /** Why a copy can't be queued (the kind's cap), shown on the disabled button. */
  duplicateBlockedReason?: string | null;
  hasFieldError: (field: UnitValidationField) => boolean;
  initialTab?: "items" | "skills" | "spells" | "special";
  /** Henchmen: remaining stash quantities for the add-henchman dialog. */
  stashQtyById?: Record<number, number>;
};
