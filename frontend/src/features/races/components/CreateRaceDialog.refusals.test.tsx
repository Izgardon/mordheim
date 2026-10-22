/** A taken race name (backend PR C, 400 `name_taken`) shows on the name field. */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { nameMatch, nameTaken, expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import CreateRaceDialog from "./CreateRaceDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = nameTaken("Ogre", [nameMatch({ kind: "races", id: 12, name: "Ogre" })]);

beforeEach(() => {
  fakeApi.reset();
  fakeApi.fail("POST /races/", taken.error);
});

describe("CreateRaceDialog: a taken name", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    const onCreated = vi.fn();
    renderWithQueryClient(<CreateRaceDialog campaignId={1} onCreated={onCreated} />);
    await user.click(screen.getByRole("button", { name: "Add race" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Human"), "Ogre");
    await user.click(within(dialog).getByRole("button", { name: "Add race" }));

    await expectFieldError(within(dialog).getByPlaceholderText("Human"), taken.detail, {
      describedBy: true,
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
