/**
 * What the skill forms do with a taken name (backend PR C, 400 `name_taken`): the message
 * shows on the name field, and the form stays open, on create and on a rename.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { quickHands } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { nameMatch, nameTaken, expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import AddSkillForm from "./AddSkillForm";
import SkillFormDialog from "./SkillFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = nameTaken("Strike to Injure", [
  nameMatch({ id: 205, name: "Strike to Injure", type: "Combat" }),
]);

beforeEach(() => {
  fakeApi.reset();
});

describe("AddSkillForm: a taken name", () => {
  it("shows on the name field when a rename takes another skill's name, and the form stays open", async () => {
    const user = setupUser();
    fakeApi.fail("PATCH /skills/900/", taken.error);
    const onUpdated = vi.fn();
    renderWithQueryClient(
      <AddSkillForm
        campaignId={1}
        editingSkill={quickHands}
        typeOptions={["Combat", "Speed"]}
        onCreated={vi.fn()}
        onUpdated={onUpdated}
        onCancel={vi.fn()}
      />
    );

    const name = screen.getByDisplayValue("Quick Hands");
    await user.clear(name);
    await user.type(name, "Strike to Injure");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await expectFieldError(name, taken.detail, { describedBy: true });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

describe("SkillFormDialog: a taken name", () => {
  it("shows on the name field and keeps the dialog open", async () => {
    const user = setupUser();
    fakeApi.fail("POST /skills/", taken.error);
    renderWithQueryClient(
      <SkillFormDialog
        mode="create"
        campaignId={1}
        typeOptions={["Combat", "Speed"]}
        onCreated={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    const dialog = screen.getByRole("dialog", { name: "Add Skill" });

    await user.type(within(dialog).getByLabelText("Name"), "Quick Hands");
    await user.click(within(dialog).getByPlaceholderText("Search or add a list"));
    await user.click(within(dialog).getByRole("button", { name: "Speed" }));
    await user.type(within(dialog).getByLabelText("Description"), "Fast.");
    await user.click(within(dialog).getByRole("button", { name: "Add skill" }));

    await expectFieldError(within(dialog).getByLabelText("Name"), taken.detail, {
      describedBy: true,
    });
    expect(screen.getByRole("dialog", { name: "Add Skill" })).toBeVisible();
  });
});
