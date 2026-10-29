/**
 * The reset-password page (AUTH-TEST-27) as a link from the reset email opens it, over the fake
 * API server: where it reads the link, what it posts, and the page after success.
 */
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PASSWORD_HINT } from "@/features/auth/components/PasswordInput";
import { AuthProvider } from "@/features/auth/stores/auth-store";
import { ApiError } from "@/lib/api-client";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import ResetPassword from "./ResetPassword";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

const LINK = "/reset-password#uid=MQ&token=cz1abc-0123456789abcdef";
const RESET_DONE = "Password has been reset.";

/** Where the router is now, as the address bar shows it. */
function AddressBar() {
  const location = useLocation();
  return <p data-testid="address">{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderReset(path = LINK) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Landing page</p>} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
        <AddressBar />
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

const newPassword = () => screen.getByLabelText("New password");
const confirmPassword = () => screen.getByLabelText("Confirm password");
const resetButton = () => screen.getByRole("button", { name: "Reset password" });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  media.mobile = false;
});

describe("ResetPassword (AUTH-TEST-27)", () => {
  it("reads uid and token from the link's fragment and posts them with the new password (SEC-12)", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/password-reset-confirm/", { detail: RESET_DONE });
    renderReset();

    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(fakeApi.calls()).toEqual(["POST /auth/password-reset-confirm/"]);
    expect(fakeApi.bodyOf("POST /auth/password-reset-confirm/")).toEqual({
      uid: "MQ",
      token: "cz1abc-0123456789abcdef",
      new_password: "wyrdstone-42",
    });
  });

  it("drops the fragment from the address bar once it has read it (SEC-12)", () => {
    renderReset();

    expect(screen.getByTestId("address")).toHaveTextContent(/^\/reset-password$/);
    expect(resetButton()).toBeEnabled();
  });

  it("takes nothing from the query string: no reset link with one was ever sent (SEC-12)", () => {
    renderReset("/reset-password?uid=MQ&token=cz1abc-0123456789abcdef");

    expect(screen.getByRole("alert")).toHaveTextContent("This reset link is incomplete.");
    expect(resetButton()).toBeDisabled();
  });

  it("after success replaces the form with 'Password updated' and a Sign in button to the sign-in card (AUTH-UX-05, AUTH-TEST-27)", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/password-reset-confirm/", { detail: RESET_DONE });
    renderReset();
    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sign in with your new password.");
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();

    await user.click(screen.getByRole("link", { name: "Sign in" }));

    expect(screen.getByText("Landing page")).toBeInTheDocument();
    expect(fakeApi.countOf("POST /auth/password-reset-confirm/")).toBe(1);
  });

  it("signs this device out after a reset, since the server has ended every session, so Sign in starts afresh", async () => {
    const user = setupUser();
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    fakeApi.on("POST /auth/password-reset-confirm/", { detail: RESET_DONE });
    renderReset();
    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("keeps the session when the reset is refused", async () => {
    const user = setupUser();
    const tokens = storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    fakeApi.fail(
      "POST /auth/password-reset-confirm/",
      new ApiError("Invalid or expired token.", 400, { detail: "Invalid or expired token." })
    );
    renderReset();
    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired token.");
    expect(localStorage.getItem("mordheim_token")).toBe(tokens.access);
  });

  it("says a link missing its token is incomplete, before anything is typed, and disables Reset password (AUTH-UX-05, AUTH-TEST-27)", () => {
    renderReset("/reset-password#uid=MQ");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This reset link is incomplete. Ask for a new one from the sign-in page."
    );
    expect(resetButton()).toBeDisabled();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("shows a refused link's reason and keeps the form for another try", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /auth/password-reset-confirm/",
      new ApiError("Invalid or expired token", 400, { detail: "Invalid or expired token" })
    );
    renderReset();
    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired token");
    expect(resetButton()).toBeEnabled();
  });

  it("says 'Passwords do not match.', as an alert, and sends nothing when the two differ", async () => {
    const user = setupUser();
    renderReset();

    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-24");
    await user.click(resetButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(fakeApi.calls()).toEqual([]);
  });

  it("announces the server's refusal as an alert, with every password rule it breaks (AUTH-UX-01, AUTH-UX-07)", async () => {
    const user = setupUser();
    const tooShort = "This password is too short. It must contain at least 8 characters.";
    const tooCommon = "This password is too common.";
    fakeApi.fail(
      "POST /auth/password-reset-confirm/",
      new ApiError(tooShort, 400, { new_password: [tooShort, tooCommon] })
    );
    renderReset();

    await user.type(newPassword(), "abc");
    await user.type(confirmPassword(), "abc");
    await user.click(resetButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      `New password: ${tooShort} ${tooCommon}`
    );
  });

  it("says the link is valid for 1 hour (AUTH-UX-05)", () => {
    renderReset();

    expect(screen.getByText(/This link is valid for 1 hour\./)).toBeInTheDocument();
    expect(screen.queryByText(/a short time/)).toBeNull();
  });

  it("has the show-password toggle on both fields and the rules under the new one (AUTH-TWEAK-07, decision 6)", async () => {
    const user = setupUser();
    renderReset();
    const toggles = screen.getAllByRole("button", { name: "Show password" });
    expect(toggles).toHaveLength(2);
    expect(newPassword()).toHaveAccessibleDescription(PASSWORD_HINT);
    expect(confirmPassword()).not.toHaveAccessibleDescription();

    await user.click(toggles[0]);

    expect(newPassword()).toHaveAttribute("type", "text");
    expect(confirmPassword()).toHaveAttribute("type", "password");
  });

  it("loads no video on desktop either, only the dark half beside the card (decision 5, AUTH-TWEAK-05)", async () => {
    const { container } = renderReset();

    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".landing-video")).toHaveAttribute("aria-hidden", "true");
  });

  it("loads no video on a phone", () => {
    media.mobile = true;
    const { container } = renderReset();

    expect(container.querySelector("iframe")).toBeNull();
  });
});
