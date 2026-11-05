import type { EditorAnswer } from "@/features/warband-templates/types/editor-types";
import type {
  TemplateFighter,
  WarbandTemplate,
} from "@/features/warband-templates/types/template-types";

// ── A template as the editor reads it (`GET warband-templates/:id/editor/`) ──────────────────

const PROFILE = {
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
};

export const makeEditorFighter = (overrides: Partial<TemplateFighter> = {}): TemplateFighter => ({
  ...PROFILE,
  id: 7,
  key: "champions",
  kind: "hero",
  name: "Champion",
  plural: "Champions",
  race_id: 1,
  race: "Human",
  cost: 35,
  starting_xp: 8,
  min_count: 0,
  max_count: 2,
  group_min: null,
  group_max: null,
  skill_types: ["Combat", "Shooting"],
  spell_types: [],
  gains_xp: true,
  promotable: true,
  is_leader: false,
  caster: "No",
  large: false,
  variant_changes: {},
  fixed_kit: "",
  lists: ["kit"],
  rules: [
    { id: 40, name: "Expert Swordsman", kind: "boon", category: "aura", description: "Re-rolls." },
  ],
  ...overrides,
});

/**
 * The book's Mercenaries, small: two variants (Middenheim with a rule and a list line of its
 * own), two types (the Middenheimers preset Middenheim), a Champion and a list, and a Mutation.
 */
export const makeEditorTemplate = (overrides: Partial<WarbandTemplate> = {}): WarbandTemplate => ({
  id: 1,
  campaign_id: null,
  setting_id: 1,
  name: "Mercenaries",
  slug: "mercenaries",
  starting_gold: 500,
  gold: 500,
  max_models: 15,
  most_warriors: 15,
  variants: [
    { key: "reikland", name: "Reikland" },
    { key: "middenheim", name: "Middenheim" },
  ],
  source: "Mordheim Rulebook",
  link_url: "",
  replaces: null,
  types: [
    {
      id: 10,
      name: "Reiklanders",
      slug: "reiklanders",
      source_code: "",
      setting_id: 1,
      campaign_id: null,
      variant: "reikland",
      archived: false,
      in_play: null,
    },
    {
      id: 11,
      name: "Middenheimers",
      slug: "middenheimers",
      source_code: "",
      setting_id: 1,
      campaign_id: null,
      variant: "middenheim",
      archived: false,
      in_play: null,
    },
  ],
  rules: [
    { id: 1, title: "Hard Bargains", description: "Haggle.", variant: "", warband_type_id: null },
    { id: 2, title: "S4 heroes", description: "", variant: "middenheim", warband_type_id: null },
  ],
  lists: [
    {
      id: 5,
      key: "kit",
      name: "Kit list",
      note: "",
      lines: [
        {
          id: 50,
          item: { id: 3, name: "Dagger", variant: "", type: "Weapon" },
          shown_as: "",
          cost: 2,
          cost_note: "",
          first_free: true,
          brace_cost: null,
          who: {},
          warband_max: null,
          note: "",
          variant: "",
          who_text: "",
        },
        {
          id: 51,
          item: { id: 4, name: "Halberd", variant: "", type: "Weapon" },
          shown_as: "",
          cost: 10,
          cost_note: "",
          first_free: false,
          brace_cost: null,
          who: {},
          warband_max: null,
          note: "",
          variant: "middenheim",
          who_text: "",
        },
      ],
    },
  ],
  fighters: [makeEditorFighter()],
  upgrades: [
    {
      id: 30,
      group: "Mutations",
      special_id: 300,
      name: "Tentacle",
      description: "Grabs.",
      kind: "boon",
      category: "mutation",
      cost: 35,
      cost_note: "",
      note: "",
      who: {},
      max_per_fighter: null,
      later_double: true,
      at_recruit: true,
      who_text: "",
    },
  ],
  ...overrides,
});

export const makeEditorAnswer = (overrides: Partial<EditorAnswer> = {}): EditorAnswer => ({
  template: makeEditorTemplate(),
  facts: { source: "book", copied_from: null, warbands: 2 },
  warnings: [],
  ...overrides,
});
