/**
 * Pass 6 characterisation: the reset-password page (AUTH-TEST-27) as a link from the reset
 * email opens it, over the fake API server: where it reads the link, what it posts, and the
 * page after success.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";
import ResetPassword from "./ResetPassword";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

const LINK = "/reset-password?uid=MQ&token=cz1abc-0123456789abcdef";
const RESET_DONE = "Password has been reset.";

function renderReset(path = LINK) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Landing page</p>} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>
  );
}

const newPassword = () => screen.getByLabelText("New password");
const confirmPassword = () => screen.getByLabelText("Confirm password");
const resetButton = () => screen.getByRole("button", { name: "Reset password" });

beforeEach(() => {
  fakeApi.reset();
  media.mobile = false;
});

describe("ResetPassword (AUTH-TEST-27)", () => {
  it("reads uid and token from the query string and posts them with the new password (SEC-12, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (SEC-12, pinned; flips in PR A: the link's fragment)
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

  it("says a link missing its token is incomplete, before anything is typed, and disables Reset password (AUTH-UX-05, AUTH-TEST-27)", () => {
    renderReset("/reset-password?uid=MQ");

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

  it("has no show-password toggle and no password hint (AUTH-TWEAK-07, pinned; flips in PR C)", () => {
    // Characterises current behaviour (AUTH-TWEAK-07, pinned; flips in PR C)
    renderReset();

    expect(newPassword()).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: /show password/i })).toBeNull();
    expect(screen.queryByText(/at least 8 characters/i)).toBeNull();
  });

  it("loads the youtube.com background video on desktop (decision 5, AUTH-TWEAK-05, pinned; flips in PR C)", () => {
    // Characterises current behaviour (decision 5, AUTH-TWEAK-05, pinned; flips in PR C)
    const { container } = renderReset();

    expect(container.querySelector("iframe")?.getAttribute("src")).toMatch(
      /^https:\/\/www\.youtube\.com\/embed\//
    );
  });

  it("loads no video on a phone", () => {
    media.mobile = true;
    const { container } = renderReset();

    expect(container.querySelector("iframe")).toBeNull();
  });
});
