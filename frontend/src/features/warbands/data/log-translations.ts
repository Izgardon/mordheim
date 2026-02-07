export const logTranslations = {
  logs: {
    personnel: {
      new_hero: "Hired {name} the {type}",
      remove_hero: "Dismissed {name} the {type}",
    },
    advance: {
      hero: "{summary}",
    },
    loadout: {
      hero: "{summary}",
    },
  },
} as const;

type LogPayload = Record<string, unknown> | null | undefined;

type LogTranslations = typeof logTranslations;

type LogFeature = keyof LogTranslations["logs"];

type LogType<Feature extends LogFeature> = keyof LogTranslations["logs"][Feature];

const templateRegex = /\{(\w+)\}/g;

export function getLogTemplate(feature: string, entryType: string) {
  const byFeature = logTranslations.logs[feature as LogFeature];
  if (!byFeature) {
    return null;
  }
  const template = byFeature[entryType as LogType<LogFeature>];
  return typeof template === "string" ? template : null;
}

export function formatLogMessage(
  feature: string,
  entryType: string,
  payload: LogPayload
) {
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

