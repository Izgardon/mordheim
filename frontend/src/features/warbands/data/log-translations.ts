export const logTranslations = {
  logs: {
    personnel: {
      new_hero: "Recruited {name} the {type}",
      remove_hero: "Dismissed {name} the {type}",
      new_henchmen_group: "Formed {name} ({type})",
      remove_henchmen_group: "Disbanded {name} ({type})",
      new_henchman: "Recruited {name} into {group}",
    },
    advance: {
      hero: "{hero} levelled up and gained a {advance_label}",
      henchmen: "{group} levelled up and gained {advance_label}",
    },
    loadout: {
      // the server names the hero or hired sword `hero` (apps/warbands/units: the loadout log rows)
      hero_skill: "{hero} learned the {skill_type} skill: {skill}",
      hero_special: "{hero} gained {special} ({special_type})",
      hero_spell: "{hero} attuned to the spell: {spell}",
      hireling_skill: "{hero} learned the {skill_type} skill: {skill}",
      hireling_special: "{hero} gained {special} ({special_type})",
      hireling_spell: "{hero} attuned to the spell: {spell}",
    },
    trading_action: {
      "rarity roll":
        "{hero} searched for: {item} [{rarity}] - Roll {roll}{modifier_text}{reason_suffix}",
    },
  },
} as const;

type LogPayload = Record<string, unknown> | null | undefined;

type LogTranslations = typeof logTranslations;

type LogFeature = keyof LogTranslations["logs"];

const templateRegex = /\{(\w+)\}/g;

export function getLogTemplate(feature: string, entryType: string) {
  const byFeature = logTranslations.logs[feature as LogFeature] as
    | Record<string, string>
    | undefined;
  if (!byFeature) {
    return null;
  }
  const template = byFeature[entryType];
  return typeof template === "string" ? template : null;
}

export function formatLogMessage(feature: string, entryType: string, payload: LogPayload) {
  const template = getLogTemplate(feature, entryType);
  if (!template) {
    return null;
  }

  const values = payload && typeof payload === "object" ? payload : {};

  return template.replace(templateRegex, (_, key) => {
    const value = values[key];
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    return "";
  });
}
