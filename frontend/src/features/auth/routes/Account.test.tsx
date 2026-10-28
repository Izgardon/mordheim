/**
 * The account page (AUTH-NEW-01 to -04) on the real routes over the fake API server: how you
 * reach it, your display name, your password, and signing out everywhere else. Deleting the
 * account has its own file.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { PASSWORD_HINT } from "@/features/auth/components/PasswordInput";
import { accessToken, RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";
import { getRefreshToken, getStoredUser, getToken } from "@/utils/storage";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const FRESH = { access: accessToken(RAIDER.id, "fresh"), refresh: "refresh-1-fresh", user: RAIDER };

const accountPage = () => screen.findByRole("heading", { name: "Account", level: 1 });
const section = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on("GET /campaigns/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("reaching the account page (AUTH-NEW-01)", () => {
  it("is linked from the campaigns list beside Log out", async () => {
    const user = setupUser();
    const app = renderApp("/campaigns");
    await screen.findByRole("heading", { name: "Welcome back, Raider" });

    await user.click(screen.getByRole("link", { name: "Account" }));

    await accountPage();
    expect(app.location().pathname).toBe("/account");
    expect(screen.getByText(`Signed in as ${RAIDER.email}`)).toBeInTheDocument();
  });

  it("has its four sections, a way back to the campaigns and Log out", async () => {
    renderApp("/account");
    await accountPage();

    for (const name of ["Display name", "Password", "Sign out everywhere else", "Delete account"]) {
      expect(section(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Campaigns" })).toHaveAttribute("href", "/campaigns");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("lands a signed-out visitor on sign-in, coming back to it afterwards", async () => {
    localStorage.clear();
    const app = renderApp("/account");

    await screen.findByRole("heading", { name: "Mordheim Chronicler" });
    expect(app.location().state).toEqual({ from: { pathname: "/account", search: "", hash: "" } });
  });
});

describe("the display name (AUTH-NEW-02)", () => {
  it("saves a new name, which the session keeps", async () => {
    fakeApi.on("PATCH /auth/me/", (body: { name: string }) => ({ ...RAIDER, name: body.name }));
    const user = setupUser();
    renderApp("/account");
    await accountPage();
    const field = within(section("Display name")).getByLabelText("Display name");
    const save = within(section("Display name")).getByRole("button", { name: "Save name" });
    expect(field).toHaveValue("Raider");
    expect(save).toBeDisabled();

    await user.clear(field);
    await user.type(field, "Raider Prime");
    await user.click(save);

    await waitFor(() => expect(getStoredUser()?.name).toBe("Raider Prime"));
    expect(fakeApi.bodyOf("PATCH /auth/me/")).toEqual({ name: "Raider Prime" });
    expect(await screen.findByText("Display name saved.")).toBeInTheDocument();
  });

  it("shows a refusal under the field (BUG-171)", async () => {
    fakeApi.fail(
      "PATCH /auth/me/",
      new ApiError("Too long", 400, { name: ["Ensure this field has no more than 40 characters."] })
    );
    const user = setupUser();
    renderApp("/account");
    await accountPage();
    const field = within(section("Display name")).getByLabelText("Display name");

    await user.type(field, " the Bold");
    await user.click(within(section("Display name")).getByRole("button", { name: "Save name" }));

    expect(await within(section("Display name")).findByRole("alert")).toHaveTextContent(
      /^Ensure this field has no more than 40 characters\.$/
    );
    expect(field).toHaveAccessibleDescription("Ensure this field has no more than 40 characters.");
  });
});

describe("the password (AUTH-NEW-03)", () => {
  async function changePassword(current: string, next: string) {
    const user = setupUser();
    renderApp("/account");
    await accountPage();
    const form = section("Password");
    await user.type(within(form).getByLabelText("Current password"), current);
    await user.type(within(form).getByLabelText("New password"), next);
    await user.click(within(form).getByRole("button", { name: "Change password" }));
    return form;
  }

  it("has the show-password toggle on both fields and the rules under the new one (AUTH-TWEAK-07)", async () => {
    renderApp("/account");
    await accountPage();
    const form = section("Password");

    expect(within(form).getAllByRole("button", { name: "Show password" })).toHaveLength(2);
    expect(within(form).getByLabelText("New password")).toHaveAccessibleDescription(PASSWORD_HINT);
    expect(within(form).getByLabelText("Current password")).not.toHaveAccessibleDescription();
  });

  it("sends the current and the new password, keeps this device's fresh pair and empties the form", async () => {
    fakeApi.on("POST /auth/password/", FRESH);

    const form = await changePassword("old-secret", "crimson-lantern-42");

    await waitFor(() => expect(getToken()).toBe(FRESH.access));
    expect(getRefreshToken()).toBe(FRESH.refresh);
    expect(fakeApi.bodyOf("POST /auth/password/")).toEqual({
      current_password: "old-secret",
      new_password: "crimson-lantern-42",
    });
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    expect(within(form).getByLabelText("Current password")).toHaveValue("");
    expect(within(form).getByLabelText("New password")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Account", level: 1 })).toBeInTheDocument();
  });

  it("shows each refusal under its own field, the session untouched", async () => {
    const stored = getToken();
    fakeApi.fail(
      "POST /auth/password/",
      new ApiError("Refused", 400, {
        current_password: ["That isn't your current password."],
        new_password: ["This password is too common."],
      })
    );

    const form = await changePassword("wrong", "password1");

    await within(form).findAllByRole("alert");
    expect(within(form).getByLabelText("Current password")).toHaveAccessibleDescription(
      "That isn't your current password."
    );
    expect(within(form).getByLabelText("New password")).toHaveAccessibleDescription(
      `${PASSWORD_HINT} This password is too common.`
    );
    expect(getToken()).toBe(stored);
  });
});

describe("signing out everywhere else (AUTH-NEW-04)", () => {
  it("is one button: this device keeps the fresh pair and stays on the page", async () => {
    fakeApi.on("POST /auth/sign-out-others/", FRESH);
    const user = setupUser();
    const app = renderApp("/account");
    await accountPage();

    await user.click(screen.getByRole("button", { name: "Sign out everywhere else" }));

    await waitFor(() => expect(getToken()).toBe(FRESH.access));
    expect(fakeApi.countOf("POST /auth/sign-out-others/")).toBe(1);
    expect(await screen.findByText("Signed out everywhere else.")).toBeInTheDocument();
    expect(app.location().pathname).toBe("/account");
  });
});
