import { describe, expect, it } from "vitest";

import { getTokenUserId } from "./token-user";

const encode = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

describe("getTokenUserId", () => {
  it("reads the user_id claim", () => {
    expect(getTokenUserId(`${encode({ alg: "HS256" })}.${encode({ user_id: 42 })}.sig`)).toBe("42");
  });

  it("returns null for anything that is not a readable JWT", () => {
    expect(getTokenUserId("garbage")).toBeNull();
    expect(getTokenUserId("a.%%%.c")).toBeNull();
    expect(getTokenUserId(`${encode({})}.${encode({ sub: "x" })}.sig`)).toBeNull();
  });
});
