import { describe, expect, it } from "vitest";

import { skillList } from "./skill-list";

describe("skillList", () => {
  it("names the five core lists and treats every other list as special", () => {
    expect(skillList("Combat")).toBe("combat");
    expect(skillList(" speed ")).toBe("speed");
    expect(skillList("Sisters of Sigmar")).toBe("special");
    expect(skillList(null)).toBe("special");
  });
});
