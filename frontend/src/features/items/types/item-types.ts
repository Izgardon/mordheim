import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type ItemProperty = {
  id: number;
  campaign_id?: number | null;
  name: string;
  description: string;
  type: string;
};

export type Restriction = {
  id: number;
  type: string;
  restriction: string;
};

export type RestrictionLink = {
  restriction: {
    id: number;
    type: string;
    restriction: string;
  };
  additional_note: string;
};

export type ItemAvailability = {
  id: number;
  cost: number;
  rarity: number;
  restrictions: RestrictionLink[];
  variable_cost?: string | null;
};

export type AvailabilityPayload = {
  cost: number;
  rarity: number;
  variable_cost?: string | null;
  restrictions?: { restriction_id: number; additional_note?: string }[];
};

/** Where a suggested sale price comes from (decision 3). */
export type SalePriceBasis = "campaign_price" | "stored_cost";

export type Item = CatalogueBadgeFields & {
  id: number;
  campaign_id?: number | null;
  /** Set on a house rule's clone of a catalogue item (BUG-51): it changes with its rule only. */
  generated_effect_key?: string | null;
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  /** Cost from the join table (HeroItem.cost, WarbandItem.cost) when loaded via warband APIs. */
  cost?: number | null;
  /** A unit's copy in a detail payload: one copy's suggested sale price (null: none known). */
  suggested_sale_price?: number | null;
  /** A unit's copy: what Buy again charges, the campaign's current price (null: unknown). */
  current_price?: number | null;
  sale_price_basis?: SalePriceBasis | null;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  properties?: { id: number; name: string; type: string }[];
  availabilities: ItemAvailability[];
  bestiary_entry?: {
    id: number;
    name: string;
    type: string;
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
    specials: { id: number; name: string; description: string }[];
  } | null;
};

export type ItemCreatePayload = {
  name: string;
  type: string;
  subtype?: string;
  grade?: string;
  single_use?: boolean;
  description: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  property_ids?: number[];
  availabilities: AvailabilityPayload[];
  campaign_id: number;
};

export type ItemUpdatePayload = {
  /** A book item's edit: the campaign whose version it makes or changes. */
  campaign_id?: number;
  name?: string;
  type?: string;
  subtype?: string;
  grade?: string;
  single_use?: boolean;
  description?: string;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  statblock?: string | null;
  property_ids?: number[];
  availabilities?: AvailabilityPayload[];
};
