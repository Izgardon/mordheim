import type { HenchmenGroup } from "../types/warband-types";

// ── Stat constants ──────────────────────────────────────────────────────

export const HERO_SELECTABLE_STATS = [
  "M", "WS", "BS", "S", "T", "W", "I", "A", "Ld",
] as const;

export type HeroSelectableStat = (typeof HERO_SELECTABLE_STATS)[number];

export const HERO_SELECTABLE_STAT_SET = new Set<string>(HERO_SELECTABLE_STATS);

export const HENCHMEN_SELECTABLE_STATS = ["WS", "BS", "S", "I", "A", "Ld"] as const;

export type HenchmenSelectableStat = (typeof HENCHMEN_SELECTABLE_STATS)[number];

export const HENCHMEN_SELECTABLE_STAT_SET = new Set<string>(HENCHMEN_SELECTABLE_STATS);

export const OTHER_OPTIONS = [
  { id: "Skill", label: "Skill" },
  { id: "Spell", label: "Spell" },
  { id: "Special", label: "Special" },
] as const;

export const STAT_NAME_MAP: Record<string, string> = {
  M: "Movement",
  WS: "Weapon Skill",
  BS: "Ballistic Skill",
  S: "Strength",
  T: "Toughness",
  W: "Wound",
  I: "Initiative",
  A: "Attack",
  Ld: "Leadership",
  Skill: "Skill",
  Spell: "Spell",
  Special: "Special",
};

export const resolveAdvanceLabel = (value: string): string =>
  STAT_NAME_MAP[value] ?? value;

// ── Dice parsing ────────────────────────────────────────────────────────

export const parseRollTotal = (results: unknown): number | null => {
  if (results === null || results === undefined) {
    return null;
  }
  const values: number[] = [];
  const extractValues = (entry: unknown) => {
    if (!entry) {
      return;
    }
    if (typeof entry === "number" && Number.isFinite(entry)) {
      values.push(entry);
      return;
    }
    if (entry && typeof entry === "object" && "rolls" in entry) {
      const rolls = (entry as { rolls?: unknown }).rolls;
      if (Array.isArray(rolls)) {
        rolls.forEach((roll) => {
          if (typeof roll === "number" && Number.isFinite(roll)) {
            values.push(roll);
          } else if (roll && typeof roll === "object" && "value" in roll) {
            const value = Number((roll as { value?: unknown }).value);
            if (Number.isFinite(value)) {
              values.push(value);
            }
          }
        });
        return;
      }
    }
    if (entry && typeof entry === "object" && "value" in entry) {
      const value = Number((entry as { value?: unknown }).value);
      if (Number.isFinite(value)) {
        values.push(value);
      }
    }
  };

  if (Array.isArray(results)) {
    results.forEach(extractValues);
  } else {
    extractValues(results);
  }

  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0);
};

// ── Hero / Hired Sword 2d6 rule table ───────────────────────────────────

export const resolveHero2d6Stat = (total: number): string | null => {
  if ([6, 8, 9].includes(total)) return null; // needs 1d6 follow-up
  if (total === 7) return "WS";
  return "Skill";
};

export const needsHero1d6Followup = (total: number): boolean =>
  [6, 8, 9].includes(total);

export const resolveHero1d6Stat = (
  roll2d6Total: number,
  roll1d6Total: number,
): string | null => {
  if (roll2d6Total === 6) return roll1d6Total <= 3 ? "S" : "A";
  if (roll2d6Total === 8) return roll1d6Total <= 3 ? "I" : "Ld";
  if (roll2d6Total === 9) return roll1d6Total <= 3 ? "W" : "T";
  return null;
};

// ── Henchmen 2d6 rule table ─────────────────────────────────────────────

export const resolveHenchmen2d6Stat = (
  total: number,
): { stat: string | null; ladsGotTalent: boolean } => {
  if (total >= 10) return { stat: null, ladsGotTalent: true };
  if (total <= 4) return { stat: "I", ladsGotTalent: false };
  if (total === 5) return { stat: "S", ladsGotTalent: false };
  if (total === 6 || total === 7) return { stat: "WS", ladsGotTalent: false };
  if (total === 8) return { stat: "A", ladsGotTalent: false };
  if (total === 9) return { stat: "Ld", ladsGotTalent: false };
  return { stat: null, ladsGotTalent: false };
};

// ── Level-up payload builders ───────────────────────────────────────────

export type LevelUpRollData = {
  dice: string;
  result: { total: number };
};

export const buildLevelUpPayload = (opts: {
  unitName: string;
  selectedStat: string;
  roll2d6Total: number | null;
  roll1d6Total?: number | null;
}) => {
  const roll1: LevelUpRollData | undefined =
    opts.roll2d6Total !== null
      ? { dice: "2d6", result: { total: opts.roll2d6Total } }
      : undefined;
  const roll2: LevelUpRollData | undefined =
    opts.roll1d6Total !== null && opts.roll1d6Total !== undefined
      ? { dice: "1d6", result: { total: opts.roll1d6Total } }
      : undefined;

  return {
    hero: opts.unitName,
    advance: {
      id: opts.selectedStat,
      label: resolveAdvanceLabel(opts.selectedStat),
    },
    ...(roll1 ? { roll1 } : {}),
    ...(roll2 ? { roll2 } : {}),
  };
};

// ── Henchmen LGT helpers ────────────────────────────────────────────────

export const resolveHenchmanFromGroup = (
  group: HenchmenGroup,
  selectedHenchmanId: string,
) => {
  const list = group.henchmen ?? [];
  const index = list.findIndex(
    (henchman, idx) => String(henchman.id ?? idx) === selectedHenchmanId,
  );
  if (index === -1) return null;
  return { henchman: list[index], index, list };
};

export const splitGroupItems = (items: HenchmenGroup["items"] = []) => {
  const remaining = [...items];
  const removed: typeof items = [];
  const seen = new Set<number>();
  items.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const idx = remaining.findIndex((entry) => entry.id === item.id);
    if (idx !== -1) {
      removed.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
  });
  return { removed, remaining };
};

export const resolveCasterValue = (group: HenchmenGroup): string => {
  const specials = group.specials ?? [];
  if (specials.some((e) => e.name?.trim().toLowerCase() === "wizard")) return "Wizard";
  if (specials.some((e) => e.name?.trim().toLowerCase() === "priest")) return "Priest";
  return "No";
};

export const resolveLargeValue = (group: HenchmenGroup): boolean => {
  if (group.large) return true;
  const specials = group.specials ?? [];
  return specials.some((e) => e.name?.trim().toLowerCase() === "large");
};

export const buildHenchmenOptions = (group: HenchmenGroup) =>
  (group.henchmen ?? []).map((henchman, index) => ({
    id: String(henchman.id ?? index),
    label: henchman.name?.trim() || `Henchman ${index + 1}`,
  }));

// ── Type guards ─────────────────────────────────────────────────────────

export const isHeroSelectableStat = (
  value: string | null,
): value is HeroSelectableStat => Boolean(value && HERO_SELECTABLE_STAT_SET.has(value));

export const isHenchmenSelectableStat = (
  value: string | null,
): value is HenchmenSelectableStat =>
  Boolean(value && HENCHMEN_SELECTABLE_STAT_SET.has(value));
