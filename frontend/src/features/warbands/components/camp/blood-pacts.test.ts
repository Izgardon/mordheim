import { describe, expect, it } from "vitest";

import { BLOOD_PACT_RULE, PACT_ROLL, pactLines, pactTotal } from "./blood-pacts";
import type { OpenCamp } from "./camp-types";

const sword = (id: number, fields: Record<string, unknown> = {}) => ({
  id,
  name: `Sword ${id}`,
  unit_type: "Ogre Bodyguard",
  can_blood_pact: true,
  blood_pact_bonus: 0,
  ...fields,
});

const camp = (hirelings: unknown[]) => ({ hirelings }) as unknown as OpenCamp;

describe("pactLines", () => {
  it("offers only the hired swords the server says could still swear one", () => {
    const lines = pactLines(
      camp([
        sword(1, { blood_pact_bonus: 2 }),
        sword(2, { can_blood_pact: false }),
        sword(3, { can_blood_pact: undefined }),
      ])
    );

    expect(lines).toEqual([{ id: 1, name: "Sword 1", bonus: 2 }]);
  });

  it("falls back to his type when he has no name", () => {
    expect(pactLines(camp([sword(1, { name: "  " })]))[0].name).toBe("Ogre Bodyguard");
  });
});

describe("pactTotal", () => {
  it("adds the bonus once both dice are in", () => {
    expect(pactTotal([5, 5], 2)).toBe(12);
    expect(pactTotal([6, 6], 0)).toBe(PACT_ROLL);
  });

  it("waits for every die", () => {
    expect(pactTotal([5, null], 2)).toBeNull();
    expect(pactTotal([], 2)).toBeNull();
  });
});

describe("the rule", () => {
  it("carries the parts the app does not automate", () => {
    const text = BLOOD_PACT_RULE.join(" ");

    expect(text).toContain("Assassins, Thieves, Merchants, Fences and Slavers never form a pact.");
    expect(text).toContain("pays no upkeep");
    expect(text).toContain("Heroes' equipment list");
    expect(text).toContain("takes command");
  });
});
