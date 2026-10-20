/**
 * What the bestiary pages' Add dialogs do with the server's refusals (backend PR A): a taken
 * name (400 `duplicate_entry`; entries and hired swords share names) shows on the name field, a
 * refused hire or upkeep cost on its field, and the dialog stays open.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCatalogue } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { duplicateEntry, expectFieldError, validationError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import BestiaryEntryFormDialog from "./BestiaryEntryFormDialog";
import HiredSwordProfileFormDialog from "./HiredSwordProfileFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = duplicateEntry("a bestiary entry or hired sword with this name");

beforeEach(() => {
  fakeApi.reset();
  routeCatalogue();
});

describe("BestiaryEntryFormDialog: a taken name", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    fakeApi.fail("POST /bestiary/", taken.error);
    const onOpenChange = vi.fn();
    renderWithQueryClient(
      <BestiaryEntryFormDialog open onOpenChange={onOpenChange} campaignId={1} />
    );

    await user.type(screen.getByLabelText("Name"), "Sewer Rat");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await expectFieldError(screen.getByLabelText("Name"), taken.detail);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("HiredSwordProfileFormDialog: refusals", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    fakeApi.fail("POST /hired-swords/", taken.error);
    const onOpenChange = vi.fn();
    renderWithQueryClient(
      <HiredSwordProfileFormDialog open onOpenChange={onOpenChange} campaignId={1} />
    );

    await user.type(screen.getByLabelText("Name"), "Pit Fighter");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await expectFieldError(screen.getByLabelText("Name"), taken.detail);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows a refused hire or upkeep cost under its field (BUG-53, CAT-TEST-16)", async () => {
    const user = setupUser();
    const wholeNumber = "A valid integer is required.";
    fakeApi.fail("POST /hired-swords/", validationError({ upkeep_cost: [wholeNumber] }));
    const onOpenChange = vi.fn();
    renderWithQueryClient(
      <HiredSwordProfileFormDialog open onOpenChange={onOpenChange} campaignId={1} />
    );

    await user.type(screen.getByLabelText("Name"), "Pit Fighter");
    await user.type(screen.getByLabelText("Upkeep Cost (gc)"), "15");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await expectFieldError(screen.getByLabelText("Upkeep Cost (gc)"), wholeNumber);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
