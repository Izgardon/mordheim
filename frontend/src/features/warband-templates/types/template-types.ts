import type { SpecialCategory } from "@/components/ui/game-icons";
import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { CatalogueProfile } from "@/features/reference/profile";
import type { StatKey } from "@/features/catalogue/utils/statblock";

/** A warband type a template serves, and the variant it always is ("" when the player picks). */
export type TemplateType = {
  id: number;
  name: string;
  slug: string;
  source_code: string;
  setting_id: number | null;
  campaign_id: number | null;
  variant: string;
  archived: boolean;
  in_play: boolean | null;
};

/**
 * A subfaction, with its own starting gold, most warriors and bonus to find rare items where its
 * rules give them (Marienburg's 600 gc and +1; the Kurgan's -1, except for the items named).
 */
export type TemplateVariant = {
  key: string;
  name: string;
  starting_gold?: number;
  max_models?: number;
  rare_bonus?: number;
  rare_bonus_except?: string[];
};

/** `GET warband-templates/?campaign_id=`: a template and the warband types it serves. */
export type WarbandTemplateSummary = CatalogueBadgeFields & {
  id: number;
  campaign_id: number | null;
  setting_id: number | null;
  name: string;
  slug: string;
  /** The book's figure (null: none, read as 500). */
  starting_gold: number | null;
  gold: number;
  max_models: number | null;
  most_warriors: number;
  variants: TemplateVariant[];
  source: string;
  link_url: string;
  types: TemplateType[];
};

/** A warband rule: for every variant or one (`variant`), and for every type or one (`warband_type_id`). */
export type TemplateRule = {
  id: number;
  title: string;
  description: string;
  variant: string;
  warband_type_id: number | null;
};

/** Who may take a list line: everyone ({}), heroes, the fighters named, or all but some (by key). */
export type TemplateWho = { heroes?: boolean; fighters?: string[]; except?: string[] };

export type TemplateLine = {
  id: number;
  item: { id: number; name: string; variant: string; type: string };
  shown_as: string;
  cost: number | null;
  cost_note: string;
  first_free: boolean;
  brace_cost: number | null;
  who: TemplateWho;
  warband_max: number | null;
  note: string;
  /** "" for every variant, else the one it is for (the Kurgan's bows). */
  variant: string;
  /** Who may take it, in the server's words: "Gaolers only", "Not Questing Knight"; blank: anyone. */
  who_text: string;
};

export type TemplateList = {
  id: number;
  key: string;
  name: string;
  note: string;
  lines: TemplateLine[];
};

/** A rule a fighter has: the special's name, its Boons & Banes kind and category (its icon), its text. */
export type TemplateSpecial = {
  id: number;
  name: string;
  kind: string;
  category: SpecialCategory;
  description: string;
};

export type TemplateSpellType = { name: string; note: string };

/**
 * What a variant changes on a fighter: Middenheim's skill table and Strength 4, the Kurgan's any
 * warhounds, the Hung's heroes' Ride [Animal] (`skills`, which he has from the start).
 */
export type VariantChange = {
  skill_types?: string[];
  stats?: Partial<Record<StatKey, number | string>>;
  max_count?: number | null;
  skills?: { id: number; name: string }[];
};

export type TemplateFighter = Omit<CatalogueProfile, "armour_save"> & {
  id: number;
  key: string;
  kind: "hero" | "henchman";
  name: string;
  plural: string;
  race_id: number | null;
  race: string | null;
  cost: number;
  starting_xp: number;
  min_count: number;
  max_count: number | null;
  group_min: number | null;
  group_max: number | null;
  skill_types: string[];
  spell_types: TemplateSpellType[];
  gains_xp: boolean;
  promotable: boolean;
  is_leader: boolean;
  caster: string;
  large: boolean;
  /** By variant key: what differs from the first variant's (its skill groups, profile as written, most). */
  variant_changes: Record<string, VariantChange>;
  fixed_kit: string;
  /** The keys of the lists he buys from. */
  lists: string[];
  rules: TemplateSpecial[];
};

export type TemplateUpgrade = {
  id: number;
  group: string;
  /** The special it gives: its id, name, text, Boons & Banes kind and category (its icon). */
  special_id: number;
  name: string;
  description: string;
  kind: string;
  category: SpecialCategory;
  cost: number | null;
  cost_note: string;
  note: string;
  /** Who may take it, as a list line's `who`. */
  who: TemplateWho;
  /** The most of its group one fighter may have (null: any). */
  max_per_fighter: number | null;
  /** The second and later of its group cost double. */
  later_double: boolean;
  /** Bought only when he is recruited. */
  at_recruit: boolean;
  /** Who may take it, in the server's words: "Tainted Ones only"; blank: any hero. */
  who_text: string;
};

/** `GET warband-templates/:id/`: the whole template. */
export type WarbandTemplate = WarbandTemplateSummary & {
  rules: TemplateRule[];
  lists: TemplateList[];
  fighters: TemplateFighter[];
  upgrades: TemplateUpgrade[];
};
