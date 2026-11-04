import type {
  TemplateFighter,
  TemplateLine,
  WarbandTemplateAnswer,
} from "@/features/warbands/types/hire-template-types";

// ── A warband's template as the hire screens and the store read it ─────────

export const makeTemplateLine = (
  id: number,
  item: { id: number; name: string },
  cost: number | null,
  overrides: Partial<TemplateLine> = {}
): TemplateLine => ({
  id,
  item: { ...item, variant: "", type: "Weapon" },
  shown_as: "",
  cost,
  cost_note: "",
  first_free: false,
  brace_cost: null,
  who: {},
  who_text: "",
  warband_max: null,
  held: null,
  note: "",
  variant: "",
  ...overrides,
});

export const makeTemplateFighter = (
  key: string,
  name: string,
  overrides: Partial<TemplateFighter> = {}
): TemplateFighter => ({
  id: name.length,
  key,
  kind: "hero",
  name,
  plural: `${name}s`,
  race_id: 1,
  race: "Human",
  cost: 35,
  starting_xp: 8,
  min_count: 0,
  max_count: 2,
  group_min: null,
  group_max: null,
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
  written_stats: {},
  skill_types: ["Combat"],
  spell_types: [],
  gains_xp: true,
  promotable: true,
  is_leader: false,
  caster: "No",
  large: false,
  fixed_kit: "",
  lists: ["kit"],
  rules: [],
  have: { count: 0, groups: 0 },
  off_lines: [],
  free_item: null,
  ...overrides,
});

export const makeTemplateAnswer = (
  template: Partial<NonNullable<WarbandTemplateAnswer["template"]>> = {},
  overrides: Partial<Omit<WarbandTemplateAnswer, "template">> = {}
): WarbandTemplateAnswer => ({
  variant: "reikland",
  list_prices_open: true,
  template: {
    id: 1,
    campaign_id: null,
    replaces: null,
    name: "Mercenaries",
    gold: 500,
    most_warriors: 15,
    variants: [{ key: "reikland", name: "Reikland" }],
    rules: [],
    missing_rules: 0,
    lists: [],
    fighters: [],
    ...template,
  },
  ...overrides,
});
