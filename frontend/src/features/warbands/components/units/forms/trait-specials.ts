import type { Special } from "@/features/special/types/special-types";
import type { HeroCaster } from "../../../types/warband-types";

const CASTER_SPECIAL_NAMES: Record<string, string> = { Wizard: "wizard", Priest: "priest" };

const named = (name: string) => (special: Special) => special.name.trim().toLowerCase() === name;

/** Adds or removes the "Large" special to match the Large trait. */
export function syncLargeSpecial(
  specials: Special[],
  large: boolean,
  availableSpecials: Special[]
): Special[] {
  const hasLarge = specials.some(named("large"));
  if (large && !hasLarge) {
    const match = availableSpecials.find(named("large"));
    return match ? [...specials, match] : specials;
  }
  if (!large && hasLarge) {
    return specials.filter((special) => !named("large")(special));
  }
  return specials;
}

/** Keeps the Wizard/Priest specials in step with the caster trait. */
export function syncCasterSpecials(
  specials: Special[],
  caster: HeroCaster,
  availableSpecials: Special[]
): Special[] {
  let next = specials;
  for (const [casterType, normalizedName] of Object.entries(CASTER_SPECIAL_NAMES)) {
    const shouldHave = caster === casterType;
    const alreadyHas = next.some(named(normalizedName));
    if (shouldHave && !alreadyHas) {
      const match = availableSpecials.find(named(normalizedName));
      if (match) next = [...next, match];
    } else if (!shouldHave && alreadyHas) {
      next = next.filter((special) => !named(normalizedName)(special));
    }
  }
  return next;
}
