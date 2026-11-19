/**
 * The callback route: the code goes to the server, the answer starts the session, and every
 * failure is a line with a way back. A code with no attempt in this browser, or a cancelled
 * consent screen, never reaches the server.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/stores/auth-store";
import { ApiError } from "@/lib/api-client";
import { session } from "@/lib/session";
import { RAIDER, loginAnswer } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { rememberSsoAttempt } from "../utils/sso-attempt";
import SsoCallback from "./SsoCallback";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const CALLBACK = "POST /auth/sso/google/callback/";

function renderCallback(search: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/auth/callback/google${search}`]}>
        <Routes>
          <Route path="/auth/callback/:provider" element={<SsoCallback />} />
          <Route path="/campaigns" element={<p>Campaigns page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  session.signOut();
  fakeApi.reset();
});

describe("finishing a sign-in", () => {
  it("sends the code with this browser's state and secret, then goes to the campaigns page", async () => {
    rememberSsoAttempt({ provider: "google", state: "xyz", browserToken: "the-secret" });
    fakeApi.on(CALLBACK, loginAnswer(RAIDER));

    renderCallback("?code=the-code&state=xyz");

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.bodyOf(CALLBACK)).toEqual({
      code: "the-code",
      state: "xyz",
      browser_token: "the-secret",
    });
    expect(session.get().user).toEqual(RAIDER);
  });

  it("exchanges the code once, even though the attempt is read as the page mounts", async () => {
    rememberSsoAttempt({ provider: "google", state: "xyz", browserToken: "the-secret" });
    fakeApi.on(CALLBACK, loginAnswer(RAIDER));

    renderCallback("?code=the-code&state=xyz");

    await screen.findByText("Campaigns page");
    expect(fakeApi.countOf(CALLBACK)).toBe(1);
  });
});

describe("what goes wrong", () => {
  it("doesn't call the server when this browser started no attempt", async () => {
    renderCallback("?code=the-code&state=xyz");

    expect(await screen.findByRole("alert")).toHaveTextContent("didn't start in this tab");
    expect(fakeApi.countOf(CALLBACK)).toBe(0);
  });

  it("doesn't call the server when the attempt was for another provider", async () => {
    rememberSsoAttempt({ provider: "discord", state: "xyz", browserToken: "the-secret" });

    renderCallback("?code=the-code&state=xyz");

    expect(await screen.findByRole("alert")).toHaveTextContent("didn't start in this tab");
    expect(fakeApi.countOf(CALLBACK)).toBe(0);
  });

  it("says a cancelled consent screen was cancelled, without calling the server", async () => {
    rememberSsoAttempt({ provider: "google", state: "xyz", browserToken: "the-secret" });

    renderCallback("?error=access_denied&state=xyz");

    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled");
    expect(fakeApi.countOf(CALLBACK)).toBe(0);
  });

  it("shows the server's refusal for a stale or forged state, and no session starts", async () => {
    rememberSsoAttempt({ provider: "google", state: "xyz", browserToken: "the-secret" });
    fakeApi.fail(
      CALLBACK,
      new ApiError("stale", 400, {
        detail: "That sign-in attempt has expired or was already used. Please try again.",
        code: "sso_invalid_state",
        fields: {},
      })
    );

    renderCallback("?code=the-code&state=xyz");

    expect(await screen.findByRole("alert")).toHaveTextContent("expired or was already used");
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(session.get().user).toBeNull();
  });

  it("offers a way back to the sign-in page", async () => {
    renderCallback("?code=the-code&state=xyz");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/")
    );
  });
});
