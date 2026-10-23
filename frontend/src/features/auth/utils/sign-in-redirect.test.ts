import { describe, expect, it } from "vitest";

import {
  returnPathFrom,
  SESSION_ENDED_MESSAGE,
  sessionEndedNotice,
  signInRedirectState,
} from "./sign-in-redirect";

const page = { pathname: "/campaigns/1/battles/2/active", search: "?unit=4", hash: "#log" };

describe("signInRedirectState", () => {
  it("keeps the page for a signed-out visit, and adds the reason when a session ended", () => {
    expect(signInRedirectState(page, null)).toEqual({ from: page });
    expect(signInRedirectState(page, "ended")).toEqual({ from: page, reason: "session-ended" });
  });

  it("keeps nothing after Log out", () => {
    expect(signInRedirectState(page, "signed-out")).toBeNull();
  });
});

describe("returnPathFrom", () => {
  it("returns to the page with its query and fragment", () => {
    expect(returnPathFrom({ from: page })).toBe("/campaigns/1/battles/2/active?unit=4#log");
  });

  it("goes to the campaigns list without a usable page", () => {
    expect(returnPathFrom(null)).toBe("/campaigns");
    expect(returnPathFrom({ from: { pathname: "/" } })).toBe("/campaigns");
    expect(returnPathFrom({ from: { pathname: "//evil.example" } })).toBe("/campaigns");
    expect(returnPathFrom({ from: { pathname: 7 } })).toBe("/campaigns");
    expect(returnPathFrom("garbage")).toBe("/campaigns");
  });
});

describe("sessionEndedNotice", () => {
  it("says why only when a session ended", () => {
    expect(sessionEndedNotice({ from: page, reason: "session-ended" })).toBe(SESSION_ENDED_MESSAGE);
    expect(SESSION_ENDED_MESSAGE).toBe("Your session ended. Please sign in again.");
    expect(sessionEndedNotice({ from: page })).toBeNull();
    expect(sessionEndedNotice(null)).toBeNull();
  });
});
