/**
 * Deleting your account from the account page (AUTH-NEW-05, decision 1), on the real routes over
 * the fake API server: the preview read as the dialog opens, campaigns to hand over first, the
 * password confirm, and the device signed out afterwards.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { AccountDeletionPreview } from "@/features/auth/types/auth-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const CAN_DELETE: AccountDeletionPreview = {
  campaigns: [
    {
      id: 4,
      name: "Lonely Tower",
      role: "owner",
      archived: false,
      outcome: "archived",
      warband: null,
    },
    {
      id: 7,
      name: "Shards",
      role: "player",
      archived: false,
      outcome: "left",
      warband: { id: 9, name: "Monks" },
    },
  ],
  battles: 1,
  trades: 2,
  can_delete: true,
};

const BLOCKED: AccountDeletionPreview = {
  campaigns: [
    {
      id: 3,
      name: "Ashes",
      role: "owner",
      archived: false,
      outcome: "hand_over_first",
      warband: null,
    },
    {
      id: 5,
      name: "Frost",
      role: "owner",
      archived: true,
      outcome: "hand_over_first",
      warband: null,
    },
  ],
  battles: 0,
  trades: 0,
  can_delete: false,
};

async function openDeleteDialog() {
  const user = setupUser();
  const app = renderApp("/account");
  await screen.findByRole("heading", { name: "Account", level: 1 });
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete your account" });
  return { user, app, dialog };
}

const deleteButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Delete my account" });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("deleting your account (AUTH-NEW-05)", () => {
  it("reads the preview as the dialog opens and says what happens to each campaign", async () => {
    fakeApi.on("GET /auth/me/deletion/", CAN_DELETE);

    const { dialog } = await openDeleteDialog();

    expect(
      await within(dialog).findByText(
        "Lonely Tower: you're its only member, so it's archived and becomes read-only."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Shards: you leave it. Your warband, Monks, stays as a retired record."
      )
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("1 open battle you're in: cancelled, or going on without you.")
    ).toBeInTheDocument();
    expect(within(dialog).getByText("2 open trades: closed.")).toBeInTheDocument();
    expect(within(dialog).getByText(/shown as Former player/)).toBeInTheDocument();
    expect(within(dialog).getByText("This can't be undone.")).toBeInTheDocument();
    expect(fakeApi.countOf("GET /auth/me/deletion/")).toBe(1);
  });

  it("lists the campaigns to hand over first, each linked to its settings, and can't be confirmed", async () => {
    fakeApi.on("GET /auth/me/deletion/", BLOCKED);

    const { dialog } = await openDeleteDialog();

    const list = await within(dialog).findByRole("list", { name: "Hand over first" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/campaigns/3/settings?tab=campaign",
      "/campaigns/5/settings?tab=campaign",
    ]);
    expect(list).toHaveTextContent("Ashes: make an admin its owner.");
    expect(list).toHaveTextContent(
      "Frost is archived: restore it, then hand it over, or delete it for good."
    );
    expect(within(dialog).queryByLabelText("Your password")).toBeNull();
    expect(deleteButton(dialog)).toBeDisabled();
  });

  it("needs the password, sends it, then signs this device out and says so", async () => {
    fakeApi.on("GET /auth/me/deletion/", CAN_DELETE);
    fakeApi.on("POST /auth/me/deletion/", null);
    const { user, app, dialog } = await openDeleteDialog();
    const password = await within(dialog).findByLabelText("Your password");
    expect(deleteButton(dialog)).toBeDisabled();

    await user.type(password, "lantern-of-sigmar");
    await user.click(deleteButton(dialog));

    await screen.findByRole("heading", { name: "Mordheim Chronicler" });
    expect(fakeApi.bodyOf("POST /auth/me/deletion/")).toEqual({
      current_password: "lantern-of-sigmar",
    });
    expect(app.location()).toMatchObject({ pathname: "/", state: null });
    expect(localStorage.length).toBe(0);
    expect(await screen.findByText("Your account is deleted.")).toBeInTheDocument();
  });

  it("shows a wrong password under the field and keeps the account", async () => {
    fakeApi.on("GET /auth/me/deletion/", CAN_DELETE);
    fakeApi.fail(
      "POST /auth/me/deletion/",
      new ApiError("Refused", 400, { current_password: ["That isn't your current password."] })
    );
    const { user, dialog } = await openDeleteDialog();
    const password = await within(dialog).findByLabelText("Your password");

    await user.type(password, "not-it");
    await user.click(deleteButton(dialog));

    await waitFor(() =>
      expect(password).toHaveAccessibleDescription("That isn't your current password.")
    );
    expect(localStorage.getItem("mordheim_token")).not.toBeNull();
    expect(screen.getByRole("dialog", { name: "Delete your account" })).toBeInTheDocument();
  });

  it("reads the preview again when a campaign gained a member since it opened (hand_over_first)", async () => {
    fakeApi.on("GET /auth/me/deletion/", CAN_DELETE);
    const body = { detail: "Hand these campaigns to an admin before you delete your account.", code: "hand_over_first", fields: {}, campaigns: [{ id: 4, name: "Lonely Tower" }] }; // prettier-ignore
    fakeApi.on("POST /auth/me/deletion/", () => {
      fakeApi.on("GET /auth/me/deletion/", BLOCKED);
      throw new ApiError(body.detail, 400, body);
    });
    const { user, dialog } = await openDeleteDialog();

    await user.type(await within(dialog).findByLabelText("Your password"), "lantern-of-sigmar");
    await user.click(deleteButton(dialog));

    expect(await within(dialog).findByText(body.detail)).toBeInTheDocument();
    await within(dialog).findByRole("list", { name: "Hand over first" });
    expect(fakeApi.countOf("GET /auth/me/deletion/")).toBe(2);
  });
});
