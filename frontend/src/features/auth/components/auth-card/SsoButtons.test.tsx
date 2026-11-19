/**
 * The provider buttons on the sign-in card: only configured providers show, pressing one asks
 * the server for the authorize URL, keeps the attempt's secret in this browser and leaves for the
 * provider. No client id or secret is ever in the browser's hands.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { takeSsoAttempt } from "../../utils/sso-attempt";
import { SsoButtons } from "./SsoButtons";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const leaveForProvider = vi.hoisted(() => vi.fn());
vi.mock("../../utils/leave-for-provider", () => ({ leaveForProvider }));

const BOTH = {
  providers: [
    { slug: "google", label: "Google" },
    { slug: "discord", label: "Discord" },
  ],
};

const START = {
  authorize_url: "https://accounts.google.com/o/oauth2/v2/auth?state=xyz",
  state: "xyz",
  browser_token: "the-secret",
};

function renderButtons() {
  return render(<SsoButtons action="Sign in" />, { wrapper: createQueryWrapper() });
}

beforeEach(() => {
  sessionStorage.clear();
  fakeApi.reset();
  leaveForProvider.mockClear();
});

describe("which providers show", () => {
  it("offers each one the server says is set up", async () => {
    fakeApi.on("GET /auth/sso/providers/", BOTH);
    renderButtons();

    expect(await screen.findByRole("button", { name: /Sign in with Google/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign in with Discord/ })).toBeInTheDocument();
  });

  it("shows nothing at all when no provider is set up", async () => {
    fakeApi.on("GET /auth/sso/providers/", { providers: [] });
    renderButtons();

    await waitFor(() => expect(fakeApi.countOf("GET /auth/sso/providers/")).toBe(1));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows nothing when the list can't be read, rather than a button that can't work", async () => {
    fakeApi.fail("GET /auth/sso/providers/", new ApiError("down", 503, null));
    renderButtons();

    await waitFor(() => expect(fakeApi.countOf("GET /auth/sso/providers/")).toBe(1));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("pressing a provider's button", () => {
  it("keeps the attempt in this browser and leaves for the provider", async () => {
    const user = setupUser();
    fakeApi.on("GET /auth/sso/providers/", BOTH);
    fakeApi.on("GET /auth/sso/google/start/", START);
    renderButtons();

    await user.click(await screen.findByRole("button", { name: /Sign in with Google/ }));

    await waitFor(() => expect(leaveForProvider).toHaveBeenCalledWith(START.authorize_url));
    expect(takeSsoAttempt()).toEqual({
      provider: "google",
      state: "xyz",
      browserToken: "the-secret",
    });
  });

  it("asks the server for Discord's URL when Discord is pressed", async () => {
    const user = setupUser();
    fakeApi.on("GET /auth/sso/providers/", BOTH);
    fakeApi.on("GET /auth/sso/discord/start/", START);
    renderButtons();

    await user.click(await screen.findByRole("button", { name: /Sign in with Discord/ }));

    await waitFor(() => expect(fakeApi.countOf("GET /auth/sso/discord/start/")).toBe(1));
    expect(fakeApi.countOf("GET /auth/sso/google/start/")).toBe(0);
  });

  it("says so and leaves nothing behind when the server won't start one", async () => {
    const user = setupUser();
    fakeApi.on("GET /auth/sso/providers/", BOTH);
    fakeApi.fail(
      "GET /auth/sso/google/start/",
      new ApiError("Google sign-in isn't set up on this server.", 503, {
        detail: "Google sign-in isn't set up on this server.",
        code: "sso_not_configured",
        fields: {},
      })
    );
    renderButtons();

    await user.click(await screen.findByRole("button", { name: /Sign in with Google/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google sign-in isn't set up on this server."
    );
    expect(leaveForProvider).not.toHaveBeenCalled();
    expect(takeSsoAttempt()).toBeNull();
  });
});
