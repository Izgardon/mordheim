import { describe, expect, it } from "vitest";

import { pillType } from "./unit-boxes";

describe("pillType", () => {
  it("drops the Warband prefix from a warband's own rule", () => {
    expect(pillType("Warband - Cult of the Possessed")).toBe("Cult of the Possessed");
  });

  it("leaves every other type, and none, as they are", () => {
    expect(pillType("Psychology")).toBe("Psychology");
    expect(pillType(null)).toBe("");
  });
});
