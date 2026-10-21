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

  it("after success shows the server's message, empties the fields and stays live: no Sign in button, and a resubmit posts again (AUTH-UX-05, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-05, pinned; flips in PR A)
    const user = setupUser();
    fakeApi.on("POST /auth/password-reset-confirm/", { detail: RESET_DONE });
    renderReset();
    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");
    await user.click(resetButton());

    expect(await screen.findByText(RESET_DONE)).toBeInTheDocument();
    expect(newPassword()).toHaveValue("");
    expect(confirmPassword()).toHaveValue("");
    expect(resetButton()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Back to sign in",
    ]);

    fakeApi.fail(
      "POST /auth/password-reset-confirm/",
      new ApiError("Invalid or expired token", 400, { detail: "Invalid or expired token" })
    );
    await user.type(newPassword(), "wyrdstone-43");
    await user.type(confirmPassword(), "wyrdstone-43");
    await user.click(resetButton());

    expect(await screen.findByText("Invalid or expired token")).toBeInTheDocument();
    expect(fakeApi.countOf("POST /auth/password-reset-confirm/")).toBe(2);
  });

  it("disables Reset password for a link missing its token, and says nothing about why (AUTH-UX-05, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-05, pinned; flips in PR A)
    const user = setupUser();
    renderReset("/reset-password?uid=MQ");

    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-42");

    expect(resetButton()).toBeDisabled();
    expect(screen.queryByText(/missing|invalid|expired/i)).toBeNull();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("says 'Passwords do not match.' and sends nothing when the two differ", async () => {
    const user = setupUser();
    renderReset();

    await user.type(newPassword(), "wyrdstone-42");
    await user.type(confirmPassword(), "wyrdstone-24");
    await user.click(resetButton());

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([]);
  });

  it("says the link 'expires after a short time' (AUTH-UX-05, pinned; flips in PR A: 'valid for 1 hour')", () => {
    // Characterises current behaviour (AUTH-UX-05, pinned; flips in PR A)
    renderReset();

    expect(screen.getByText(/This link expires after a short time\./)).toBeInTheDocument();
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
