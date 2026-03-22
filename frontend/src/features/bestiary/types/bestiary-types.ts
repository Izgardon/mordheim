export type BestiaryEntryEquipment = {
  item: {
    id: number;
    name: string;
    type: string;
    description: string;
  };
  quantity: number;
};

export type BestiaryEntrySummary = {
  id: number;
  campaign_id: number | null;
  name: string;
  type: string;
  description: string;
  movement: number;
  weapon_skill: number;
  ballistic_skill: number;
  strength: number;
  toughness: number;
  wounds: number;
  initiative: number;
  attacks: number;
  leadership: number;
  armour_save: number | null;
  large: boolean;
  caster: string;
};

export type BestiaryEntry = BestiaryEntrySummary & {
  skills: { id: number; name: string; type: string; description: string }[];
  specials: { id: number; name: string; description: string }[];
  spells: { id: number; name: string; description: string }[];
  equipment: BestiaryEntryEquipment[];
};

export type BestiaryEntryCreatePayload = {
  campaign_id: number;
  name: string;
  type: string;
  description?: string;
  movement?: number;
  weapon_skill?: number;
  ballistic_skill?: number;
  strength?: number;
  toughness?: number;
  wounds?: number;
  initiative?: number;
  attacks?: number;
  leadership?: number;
  armour_save?: number | null;
  large?: boolean;
  caster?: string;
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
  item_entries?: { item_id: number; quantity?: number }[];
};

export type BestiaryEntryUpdatePayload = Partial<
  Omit<BestiaryEntryCreatePayload, "campaign_id">
>;

export type HiredSwordProfileRestriction = {
  restriction: {
    id: number;
    type: string;
    restriction: string;
  };
  additional_note: string;
};

export type HiredSwordProfileSummary = {
  id: number;
  campaign_id: number | null;
  hire_cost: number | null;
  hire_cost_expression: string;
  upkeep_cost: number | null;
  upkeep_cost_expression: string;
  rating: number | null;
  available_skill_types: string[];
  restrictions: HiredSwordProfileRestriction[];
  bestiary_entry: BestiaryEntrySummary;
};

export type HiredSwordProfile = {
  id: number;
  campaign_id: number | null;
  hire_cost: number | null;
  hire_cost_expression: string;
  upkeep_cost: number | null;
  upkeep_cost_expression: string;
  rating: number | null;
  available_skill_types: string[];
  restrictions: HiredSwordProfileRestriction[];
  bestiary_entry: BestiaryEntry;
};

export type HiredSwordProfileCreatePayload = BestiaryEntryCreatePayload & {
  hire_cost?: number | null;
  hire_cost_expression?: string;
  upkeep_cost?: number | null;
  upkeep_cost_expression?: string;
  rating?: number | null;
  available_skill_types?: string[];
  restriction_ids?: (
    | number
    | { restriction_id: number; additional_note?: string }
  )[];
};

export type HiredSwordProfileUpdatePayload = Partial<
  Omit<HiredSwordProfileCreatePayload, "campaign_id">
>;
