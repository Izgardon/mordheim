import { describe, expect, it } from "vitest";

import { formatLogMessage } from "./log-translations";

describe("formatLogMessage", () => {
  it("names the hero who learned a skill, gained a special or a spell (the server's `hero`)", () => {
    const skill = { hero: "Dieter Brandt", skill: "Step Aside", skill_type: "Combat" };
    expect(formatLogMessage("loadout", "hero_skill", skill)).toBe(
      "Dieter Brandt learned the Combat skill: Step Aside"
    );
    expect(
      formatLogMessage("loadout", "hero_special", {
        hero: "Otto",
        special: "Mark of Nurgle",
        special_type: "Mark",
      })
    ).toBe("Otto gained Mark of Nurgle (Mark)");
    expect(
      formatLogMessage("loadout", "hero_spell", { hero: "Mortis", spell: "Lifestealer" })
    ).toBe("Mortis attuned to the spell: Lifestealer");
  });

  it("says the same of a hired sword's, which had no words at all", () => {
    const skill = { hero: "Grukk", skill: "Mighty Blow", skill_type: "Strength" };
    expect(formatLogMessage("loadout", "hireling_skill", skill)).toBe(
      "Grukk learned the Strength skill: Mighty Blow"
    );
    expect(
      formatLogMessage("loadout", "hireling_special", {
        hero: "Grukk",
        special: "Horrible Scars",
        special_type: "Injury",
      })
    ).toBe("Grukk gained Horrible Scars (Injury)");
    expect(formatLogMessage("loadout", "hireling_spell", { hero: "Elf Mage", spell: "Fog" })).toBe(
      "Elf Mage attuned to the spell: Fog"
    );
  });
});
