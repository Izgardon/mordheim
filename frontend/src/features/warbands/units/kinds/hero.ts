import { getHeroLevelInfo } from "../../components/heroes/utils/hero-level";
import HeroCardHeader from "../../components/units/kinds/hero/HeroCardHeader";
import {
  HeroExpandedTitle,
  HeroPendingDialogs,
} from "../../components/units/kinds/hero/HeroCardSlots";
import HeroExpandedTiles from "../../components/units/kinds/hero/HeroExpandedTiles";
import HeroFormBasics from "../../components/units/kinds/hero/HeroFormBasics";
import { useFollowUpAdvance } from "../../hooks/units/useFollowUpAdvance";
import {
  HERO_SELECTABLE_STAT_SET,
  HERO_SELECTABLE_STATS,
  OTHER_OPTIONS,
} from "../../utils/levelup-utils";
import { buildAvailableSkillsPayload, toNullableNumber } from "../../utils/warband-utils";
import { buildStatPayload } from "../unit-form-helpers";
import { heroEditor } from "./hero-editor";
import { buildLoadoutPayload, mapHeroToForm, validateHeroForm } from "./hero-forms";

import type { UnitKindConfig } from "../unit-kind-types";

export { buildLoadoutPayload, mapHeroToForm, validateHeroForm };

export const FOLLOW_UP_ROLL_TABLE = {
  lines: [
    "2–5: New Skill",
    "6: +1 Str or +1 Att (1d6)",
    "7: +1 WS or +1 BS",
    "8: +1 Init or +1 Ld (1d6)",
    "9: +1 W or +1 T (1d6)",
    "10–12: New Skill",
  ],
  maxWidth: 240,
};

export const heroKind: UnitKindConfig<"hero"> = {
  key: "hero",
  section: "heroes",
  listKey: "heroes",
  collection: "heroes",
  cardClassName: "warband-card--hero",
  labels: {
    plural: "Heroes",
    singular: "Hero",
    edit: "Edit Heroes",
    add: "Add hero",
    create: "Create hero",
    fallbackName: (index) => `Hero ${index + 1}`,
    untitled: "Untitled hero",
    typeFallback: "Hero",
    unnamed: "Unnamed Hero",
    killsName: "hero",
    empty: "No heroes logged yet. Start with your leader.",
    dismiss: "Dismiss",
    dismissConfirm: "Dismiss hero",
    dismissVerb: "dismiss",
    draftNoun: "hero",
    saveError: "Unable to update warband",
    unknownName: "Unknown Hero",
    newUnit: "New Hero",
    addNew: "Add New",
    formIdPrefix: "hero",
  },
  flags: {
    hasSpells: true,
    hasMembers: false,
    hasTradeAction: true,
    canLead: true,
    supportsNoLevelUps: false,
    hasUpkeep: false,
    hasPendingAdvances: true,
    reportsMoveTarget: true,
    scrollsIntoViewOnExpand: false,
    savesWarbandHeader: true,
  },
  thresholdsKey: "hero_level_thresholds",
  advanceOptions: [...HERO_SELECTABLE_STATS, ...OTHER_OPTIONS.map((option) => option.id)],
  getLevelInfo: getHeroLevelInfo,
  showsXpBar: () => true,
  canLevelUp: (hero) => Boolean(hero.level_up),
  killCount: (hero) => hero.kills ?? 0,
  mapToForm: mapHeroToForm,
  validate: validateHeroForm,
  // No level_up for a hero created this session (BUG-65); armour save as a number (BUG-87).
  buildPayload: (hero) => ({
    name: hero.name.trim() || null,
    unit_type: hero.unit_type.trim() || null,
    race: hero.race_id ?? null,
    price: toNullableNumber(hero.price) ?? 0,
    xp: toNullableNumber(hero.xp) ?? 0,
    deeds: hero.deeds.trim() || null,
    is_leader: hero.is_leader,
    trading_action: hero.trading_action,
    armour_save: Number(hero.armour_save.trim()) || null,
    large: hero.large,
    caster: hero.caster,
    half_rate: hero.half_rate,
    available_skills: buildAvailableSkillsPayload(hero.available_skills),
    ...buildStatPayload(hero),
    ...buildLoadoutPayload(hero),
  }),
  buildXpPayload: (hero, xp) => ({
    name: hero.name,
    unit_type: hero.unit_type,
    race: hero.race_id ?? null,
    price: hero.price,
    xp,
    is_leader: hero.is_leader ?? false,
  }),
  levelUp: {
    selectableStats: HERO_SELECTABLE_STAT_SET,
    rollTable: FOLLOW_UP_ROLL_TABLE,
    nameFallback: "Unknown Hero",
    useAdvance: useFollowUpAdvance,
  },
  addForm: {
    actionsClassName: "flex flex-wrap items-center justify-between gap-3",
    actionsInnerClassName: "ml-auto flex items-center gap-2",
    buttonWrapperClassName: "scroll-mt-28",
  },
  slots: {
    SummaryHeader: HeroCardHeader,
    ExpandedTitle: HeroExpandedTitle,
    ExpandedTiles: HeroExpandedTiles,
    PendingAdvanceDialogs: HeroPendingDialogs,
    FormBasics: HeroFormBasics,
  },
  editor: heroEditor,
};
