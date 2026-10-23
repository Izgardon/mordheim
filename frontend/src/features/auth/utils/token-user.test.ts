import { beforeEach, describe, expect, it } from "vitest";

import { cachedUserFor, getTokenUserId } from "./token-user";

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

describe("cachedUserFor", () => {
  const raider = { id: 1, email: "raider@example.com", name: "Raider" };
  const tokenFor = (userId: number) =>
    `${encode({ alg: "HS256" })}.${encode({ user_id: userId })}.sig`;

  beforeEach(() => localStorage.clear());

  it("returns the user cached beside a token of that account", () => {
    localStorage.setItem("mordheim_user", JSON.stringify(raider));
    expect(cachedUserFor(tokenFor(1))).toEqual(raider);
  });

  it("returns null for another account's token, no token, or nothing readable cached", () => {
    localStorage.setItem("mordheim_user", JSON.stringify(raider));
    expect(cachedUserFor(tokenFor(2))).toBeNull();
    expect(cachedUserFor(null)).toBeNull();
    expect(cachedUserFor("garbage")).toBeNull();
    localStorage.setItem("mordheim_user", "{not json");
    expect(cachedUserFor(tokenFor(1))).toBeNull();
    localStorage.setItem("mordheim_user", JSON.stringify({ id: "1" }));
    expect(cachedUserFor(tokenFor(1))).toBeNull();
  });
});
