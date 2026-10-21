/**
 * Pass 6 characterisation: the app's route guards and redirects, on the real routes and
 * providers over the fake API server. Signed-out visits, deep links surviving sign-in
 * (AUTH-TEST-28), unknown URLs (FE-TEST-18), a session ending mid-visit and Log out.
 */
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession, tokensFor } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";
import { clearToken } from "@/utils/storage";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const landing = () => screen.findByRole("heading", { name: "Mordheim Chronicler" });
const campaignsPage = () => screen.findByRole("heading", { name: "Welcome back, Raider" });

const submitButton = () =>
  screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")!;

async function signInOnLanding() {
  const user = setupUser();
  await user.type(screen.getByLabelText("Email"), RAIDER.email);
  await user.type(screen.getByLabelText("Password"), "wyrdstone");
  await user.click(submitButton());
}

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  fakeApi.on("POST /auth/login/", tokensFor(RAIDER));
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on("GET /campaigns/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("signed out", () => {
  it("a visit to /campaigns lands on / with no reason and nothing to come back to (AUTH-UX-02, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-02, pinned; flips in PR A: state.from and a reason)
    const app = renderApp("/campaigns");

    await landing();
    expect(app.location().pathname).toBe("/");
    expect(app.location().state).toBeNull();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("a deep link ends on /campaigns after sign-in, not on the page it asked for (AUTH-TEST-28, AUTH-UX-02, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-TEST-28, AUTH-UX-02, pinned; flips in PR A)
    const app = renderApp("/campaigns/1/battles/2/active");
    await landing();

    await signInOnLanding();

    await campaignsPage();
    expect(app.location().pathname).toBe("/campaigns");
  });
});

describe("an unknown URL", () => {
  it("redirects a signed-out visitor to /, and NotFound is never shown (FE-TEST-18, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (FE-TEST-18, FE-UX-03, pinned; flips in PR A: `*` renders NotFound)
    const app = renderApp("/nope");

    await landing();
    expect(app.location().pathname).toBe("/");
    expect(screen.queryByText("LOST IN THE RUINS")).toBeNull();
  });

  it("redirects a signed-in visitor to /, and the sign-in card sends them on to /campaigns (FE-TEST-18, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (FE-TEST-18, FE-UX-03, pinned; flips in PR A)
    storeSession();
    const app = renderApp("/campaigns/1/nope/deeper");

    await campaignsPage();
    expect(app.location().pathname).toBe("/campaigns");
    expect(screen.queryByText("LOST IN THE RUINS")).toBeNull();
  });
});

describe("a session that ends", () => {
  it("mid-visit lands on / with no reason given (AUTH-UX-02, AUTH-TWEAK-04, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-02, AUTH-TWEAK-04, pinned; flips in PR A:
    // "Your session ended. Please sign in again.")
    storeSession();
    const app = renderApp("/campaigns");
    await campaignsPage();

    // What api-client does when the refresh token is refused.
    act(() => clearToken());

    await landing();
    expect(app.location()).toMatchObject({ pathname: "/", state: null });
    expect(screen.queryByText(/session/i)).toBeNull();
    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("by Log out lands on / and tells the server nothing", async () => {
    storeSession();
    const app = renderApp("/campaigns");
    await campaignsPage();
    fakeApi.clearRequests();

    await setupUser().click(screen.getByRole("button", { name: "Log out" }));

    await landing();
    expect(app.location().pathname).toBe("/");
    expect(localStorage.length).toBe(0);
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("pages outside the gate", () => {
  it("opens /reset-password for a signed-in user too, with no redirect", async () => {
    storeSession();
    const app = renderApp("/reset-password?uid=MQ&token=abc");

    expect(await screen.findByText("Set a new password")).toBeInTheDocument();
    expect(app.location().pathname).toBe("/reset-password");
    expect(fakeApi.calls()).toEqual(["GET /auth/me/"]);
  });
});
