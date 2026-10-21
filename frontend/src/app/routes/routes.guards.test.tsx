/**
 * Pass 6 characterisation: the app's route guards and redirects, on the real routes and
 * providers over the fake API server. Signed-out visits, deep links surviving sign-in
 * (AUTH-TEST-28), unknown URLs (FE-TEST-18), a session ending mid-visit and Log out.
 */
import { act, screen, waitFor } from "@testing-library/react";
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

const SESSION_ENDED = "Your session ended. Please sign in again.";

describe("signed out", () => {
  it("a visit to /campaigns lands on / remembering the page, with no reason given (AUTH-UX-02)", async () => {
    const app = renderApp("/campaigns");

    await landing();
    expect(app.location().pathname).toBe("/");
    expect(app.location().state).toEqual({
      from: { pathname: "/campaigns", search: "", hash: "" },
    });
    expect(screen.queryByText(SESSION_ENDED)).toBeNull();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("a deep link comes back to the page it asked for after sign-in (AUTH-TEST-28, AUTH-UX-02)", async () => {
    const app = renderApp("/campaigns/1/battles/2/active");
    await landing();

    await signInOnLanding();

    await waitFor(() => expect(app.location().pathname).toBe("/campaigns/1/battles/2/active"));
  });
});

describe("an unknown URL", () => {
  it("shows NotFound to a signed-out visitor, at the URL they asked for, with a way back (FE-TEST-18, FE-UX-03)", async () => {
    const app = renderApp("/nope");

    expect(await screen.findByRole("heading", { name: "LOST IN THE RUINS" })).toBeInTheDocument();
    expect(app.location().pathname).toBe("/nope");
    expect(fakeApi.calls()).toEqual([]);

    await setupUser().click(screen.getByRole("link", { name: "Back to the chronicle" }));

    await landing();
  });

  it("shows NotFound to a signed-in visitor too, and the way back goes on to the campaigns list (FE-TEST-18, FE-UX-03)", async () => {
    storeSession();
    const app = renderApp("/campaigns/1/nope/deeper");

    expect(await screen.findByRole("heading", { name: "LOST IN THE RUINS" })).toBeInTheDocument();
    expect(app.location().pathname).toBe("/campaigns/1/nope/deeper");

    await setupUser().click(screen.getByRole("link", { name: "Back to the chronicle" }));

    await campaignsPage();
    expect(app.location().pathname).toBe("/campaigns");
  });
});

describe("a session that ends", () => {
  it("mid-visit lands on / saying so, and signing in again comes back to the page (AUTH-UX-02, AUTH-TWEAK-04)", async () => {
    storeSession();
    const app = renderApp("/campaigns?from=bell");
    await campaignsPage();

    // What api-client does when the refresh token is refused.
    act(() => clearToken());

    await landing();
    expect(app.location()).toMatchObject({
      pathname: "/",
      state: {
        from: { pathname: "/campaigns", search: "?from=bell", hash: "" },
        reason: "session-ended",
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(SESSION_ENDED);
    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0);

    await signInOnLanding();

    await campaignsPage();
    expect(app.location()).toMatchObject({ pathname: "/campaigns", search: "?from=bell" });
  });

  it("by Log out lands on / with no reason and no page to come back to, and tells the server nothing", async () => {
    storeSession();
    const app = renderApp("/campaigns");
    await campaignsPage();
    fakeApi.clearRequests();

    await setupUser().click(screen.getByRole("button", { name: "Log out" }));

    await landing();
    expect(app.location()).toMatchObject({ pathname: "/", state: null });
    expect(screen.queryByText(SESSION_ENDED)).toBeNull();
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
