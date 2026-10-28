/**
 * Asked once for a display name (AUTH-NEW-06, decision 2), on the real routes over the fake API
 * server: a signed-in user without a name gets a one-field dialog over the next screen, with no
 * Skip and no way to close it, until a name is saved.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { NAMELESS, RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";
import { getStoredUser } from "@/utils/storage";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const prompt = () => screen.findByRole("dialog", { name: "Choose a display name" });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  fakeApi.on("GET /notifications/", []);
  fakeApi.on("GET /campaigns/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("the display name prompt (AUTH-NEW-06)", () => {
  it("asks a user without a name, says what others see meanwhile, and stays open", async () => {
    storeSession(NAMELESS);
    fakeApi.on("GET /auth/me/", NAMELESS);
    const user = setupUser();
    renderApp("/campaigns");

    const dialog = await prompt();
    expect(dialog).toHaveTextContent(`Until you choose one, they see "Player ${NAMELESS.id}".`);
    expect(within(dialog).queryByRole("button", { name: /skip|cancel|close/i })).toBeNull();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Choose a display name" })).toBeInTheDocument();
  });

  it("saves the name through PATCH auth/me/ and goes, and the page greets them by it", async () => {
    storeSession(NAMELESS);
    fakeApi.on("GET /auth/me/", NAMELESS);
    fakeApi.on("PATCH /auth/me/", (body: { name: string }) => ({ ...NAMELESS, name: body.name }));
    const user = setupUser();
    renderApp("/campaigns");

    await user.type(within(await prompt()).getByLabelText("Display name"), "Ned of the Docks");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Ned of the Docks" })
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fakeApi.bodyOf("PATCH /auth/me/")).toEqual({ name: "Ned of the Docks" });
    expect(getStoredUser()?.name).toBe("Ned of the Docks");
  });

  it("shows the server's refusal under the field, labelled as the field is (BUG-171)", async () => {
    storeSession(NAMELESS);
    fakeApi.on("GET /auth/me/", NAMELESS);
    fakeApi.fail(
      "PATCH /auth/me/",
      new ApiError("This field may not be blank.", 400, { name: ["This field may not be blank."] })
    );
    const user = setupUser();
    renderApp("/campaigns");

    await user.type(within(await prompt()).getByLabelText("Display name"), "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const field = screen.getByLabelText("Display name");
    expect(await screen.findByRole("alert")).toHaveTextContent(/^This field may not be blank\.$/);
    expect(field).toHaveAccessibleDescription("This field may not be blank.");
    expect(screen.getByRole("dialog", { name: "Choose a display name" })).toBeInTheDocument();
  });

  it("never shows for a user with a name", async () => {
    storeSession(RAIDER);
    fakeApi.on("GET /auth/me/", RAIDER);
    renderApp("/campaigns");

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Raider" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
