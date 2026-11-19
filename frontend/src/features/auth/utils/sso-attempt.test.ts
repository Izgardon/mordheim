import { beforeEach, describe, expect, it, vi } from "vitest";

import { rememberSsoAttempt, takeSsoAttempt } from "./sso-attempt";

const ATTEMPT = { provider: "google", state: "the-state", browserToken: "the-secret" };

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("the sign-in attempt this browser started", () => {
  it("comes back once, and is gone after that, so a reload can't replay it", () => {
    rememberSsoAttempt(ATTEMPT);

    expect(takeSsoAttempt()).toEqual(ATTEMPT);
    expect(takeSsoAttempt()).toBeNull();
  });

  it("is null when nothing was stored", () => {
    expect(takeSsoAttempt()).toBeNull();
  });

  it("is null when what was stored isn't an attempt", () => {
    sessionStorage.setItem("mordheim_sso_attempt", '{"provider":"google"}');

    expect(takeSsoAttempt()).toBeNull();
  });

  it("is null when the stored value isn't JSON", () => {
    sessionStorage.setItem("mordheim_sso_attempt", "not json");

    expect(takeSsoAttempt()).toBeNull();
  });

  it("survives a browser that refuses to store or read it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberSsoAttempt(ATTEMPT)).not.toThrow();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(takeSsoAttempt()).toBeNull();
  });
});
