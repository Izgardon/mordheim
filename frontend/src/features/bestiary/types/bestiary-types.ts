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
  armour_save: string;
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
  armour_save?: string;
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
