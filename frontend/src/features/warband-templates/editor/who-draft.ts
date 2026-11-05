import type { TemplateWho } from "../types/template-types";

/** Who may take a line or an upgrade, as its field picks it. */
export type WhoMode = "everyone" | "heroes" | "named" | "except";

export const WHO_MODES: { value: WhoMode; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "heroes", label: "Heroes" },
  { value: "named", label: "Named fighters" },
  { value: "except", label: "All but named" },
];

export const whoMode = (who: TemplateWho): WhoMode =>
  "except" in who ? "except" : who.heroes ? "heroes" : who.fighters?.length ? "named" : "everyone";

/** The fighters a who names (for heroes: the henchmen let in besides them). */
export const namedKeys = (who: TemplateWho) => who.except ?? who.fighters ?? [];

/** A mode's who with the names picked so far; one naming nobody is open to everyone. */
export function whoFor(mode: WhoMode, keys: string[]): TemplateWho {
  if (mode === "everyone") return {};
  if (mode === "except") return keys.length ? { except: keys } : {};
  if (mode === "heroes") return keys.length ? { heroes: true, fighters: keys } : { heroes: true };
  return keys.length ? { fighters: keys } : {};
}
