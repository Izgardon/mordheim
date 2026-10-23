/**
 * What the Bestiary's Add dialog does with the server's refusals (backend PR A): a taken name
 * (400 `name_taken`) shows on the name field, and the dialog stays open. The hired-sword and
 * dramatis-persona forms' refusals are in features/hirelings.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { routeCatalogue } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { nameMatch, nameTaken, expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import BestiaryEntryFormDialog from "./BestiaryEntryFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = nameTaken("Sewer Rat", [
  nameMatch({ kind: "bestiary", id: 90, name: "Sewer Rat", type: "Attack", source: "campaign" }),
]);

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
