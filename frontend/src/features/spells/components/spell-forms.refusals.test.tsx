/**
 * What the spell forms do with a taken name (backend PR A, 400 `duplicate_entry`): the message
 * shows on the name field, and the form stays open.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { duplicateEntry, expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import AddSpellForm from "./AddSpellForm";
import CreateSpellDialog from "./CreateSpellDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = duplicateEntry("a spell with this name and type");

beforeEach(() => {
  fakeApi.reset();
  fakeApi.fail("POST /spells/", taken.error);
});

describe("AddSpellForm: a taken name", () => {
  it("shows on the name field, and the form stays open", async () => {
    const user = setupUser();
    const onCreated = vi.fn();
    renderWithQueryClient(
      <AddSpellForm
        campaignId={1}
        typeOptions={["Lesser Magic"]}
        onCreated={onCreated}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Fireball"), "Gutter Hex");
    await user.click(screen.getByPlaceholderText("Search or add a class"));
    await user.click(screen.getByRole("button", { name: "Lesser Magic" }));
    await user.type(screen.getByPlaceholderText("Describe the spell."), "Again.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await expectFieldError(screen.getByPlaceholderText("Fireball"), taken.detail);
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("CreateSpellDialog: a taken name", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <CreateSpellDialog campaignId={1} typeOptions={["Lesser Magic"]} onCreated={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: "Add spell" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Fireball"), "Gutter Hex");
    await user.click(within(dialog).getByPlaceholderText("Search or add a class"));
    await user.click(within(dialog).getByRole("button", { name: "Lesser Magic" }));
    await user.type(within(dialog).getByPlaceholderText("Describe the spell."), "Again.");
    await user.click(within(dialog).getByRole("button", { name: "Add spell" }));

    await expectFieldError(within(dialog).getByPlaceholderText("Fireball"), taken.detail);
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
