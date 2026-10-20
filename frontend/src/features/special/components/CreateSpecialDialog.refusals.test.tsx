/** A taken special name (backend PR A, 400 `duplicate_entry`) shows on the name field. */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { duplicateEntry, expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import CreateSpecialDialog from "./CreateSpecialDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = duplicateEntry("a special with this name and type");

beforeEach(() => {
  fakeApi.reset();
  fakeApi.fail("POST /special/", taken.error);
});

describe("CreateSpecialDialog: a taken name", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    const onCreated = vi.fn();
    renderWithQueryClient(<CreateSpecialDialog campaignId={1} onCreated={onCreated} />);
    await user.click(screen.getByRole("button", { name: "Add special" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Blessing"), "Leader");
    await user.type(within(dialog).getByPlaceholderText("Search or add a special"), "Trait");
    await user.click(within(dialog).getByRole("button", { name: "Add custom category" }));
    await user.type(within(dialog).getByPlaceholderText("Describe the entry."), "Leads.");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));

    await expectFieldError(within(dialog).getByPlaceholderText("Blessing"), taken.detail);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
