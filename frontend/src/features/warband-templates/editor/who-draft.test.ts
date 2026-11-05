import { describe, expect, it } from "vitest";

import { whoFor, whoMode } from "./who-draft";

describe("who may take it", () => {
  it("reads and writes everyone, heroes with henchmen named, the named, and all but the named", () => {
    expect([
      whoMode({}),
      whoMode({ heroes: true }),
      whoMode({ fighters: ["a"] }),
      whoMode({ except: ["a"] }),
    ]).toEqual(["everyone", "heroes", "named", "except"]);
    expect(whoFor("heroes", ["warriors"])).toEqual({ heroes: true, fighters: ["warriors"] });
    expect(whoFor("named", [])).toEqual({}); // naming nobody is open to everyone
    expect(whoFor("except", ["hounds"])).toEqual({ except: ["hounds"] });
  });
});
