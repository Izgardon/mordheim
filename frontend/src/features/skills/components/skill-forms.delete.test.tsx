/**
 * Deleting a custom skill from the Skills page's form (`AddSkillForm`) and from the warband pages'
 * dialog (`SkillFormDialog`, whose edit mode no screen opens today): the confirm's copy, the one
 * DELETE it sends with no usage check, and what a refused delete looks like. The server removes
 * the skill from every unit that knows it (BUG-16); PR A answers 409 `in_use` instead, and PR C
 * asks `usage/` first and archives what is in use.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SKILLS, quickHands } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AddSkillForm from "./AddSkillForm";
import SkillFormDialog from "./SkillFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const SKILLS_KEY = queryKeys.campaign.catalogue(1, "skills");
const DELETE = "DELETE /skills/900/";
const IN_USE = new ApiError("Quick Hands is known by 3 heroes.", 409, { code: "in_use" });

function clientWithSkills() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(SKILLS_KEY, SKILLS);
  return queryClient;
}

const cachedNames = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  (queryClient.getQueryData<typeof SKILLS>(SKILLS_KEY) ?? []).map((entry) => entry.name);

beforeEach(() => {
  fakeApi.reset();
});

describe("AddSkillForm: Delete", () => {
  function renderForm(queryClient = clientWithSkills()) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <AddSkillForm
        campaignId={1}
        editingSkill={quickHands}
        typeOptions={["Combat", "Speed"]}
        onCreated={vi.fn()}
        onDeleted={onDeleted}
        onCancel={vi.fn()}
      />,
      { queryClient }
    );
    return { onDeleted, queryClient };
  }

  // Characterises current behaviour (BUG-16, CAT-TWEAK-04, pinned; flips in PR C)
  it('says only "This action cannot be undone", then sends one DELETE with no usage check (BUG-16, pinned; flips in PR C)', async () => {
    const user = setupUser();
    fakeApi.on(DELETE, undefined);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    expect(confirm).toHaveTextContent("Delete Quick Hands? This action cannot be undone.");
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(onDeleted).toHaveBeenCalledWith(900);
    expect(cachedNames(queryClient)).toEqual(["Strike to Injure"]);
    expect(queryClient.getQueryState(SKILLS_KEY)?.isInvalidated).toBe(true);
  });

  // Characterises current behaviour (BUG-16, BUG-148, pinned; flips in PR A)
  it("leaves the confirm open after a refused delete and writes the error into the form behind it (BUG-148, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete skill" })
    );

    expect(await screen.findByText("Quick Hands is known by 3 heroes.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("known by 3 heroes");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames(queryClient)).toContain("Quick Hands");
  });
});

describe("SkillFormDialog (edit mode): Delete", () => {
  async function openDialog(user: ReturnType<typeof setupUser>, queryClient = clientWithSkills()) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <SkillFormDialog
        mode="edit"
        skill={quickHands}
        typeOptions={["Combat", "Speed"]}
        onUpdated={vi.fn()}
        onDeleted={onDeleted}
      />,
      { queryClient }
    );
    await user.click(screen.getByRole("button", { name: "Edit skill" }));
    return { onDeleted, queryClient };
  }

  // Characterises current behaviour (BUG-16, CAT-TWEAK-04, pinned; flips in PR C)
  it('says only "This action cannot be undone", then sends one DELETE with no usage check (BUG-16, pinned; flips in PR C)', async () => {
    const user = setupUser();
    fakeApi.on(DELETE, undefined);
    const { onDeleted, queryClient } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    expect(confirm).toHaveTextContent("Delete Quick Hands? This action cannot be undone.");
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    expect(fakeApi.calls()).toEqual([DELETE]);
    expect(onDeleted).toHaveBeenCalledWith(900);
    // The skill's own campaign_id names the cached list it leaves.
    expect(cachedNames(queryClient)).toEqual(["Strike to Injure"]);
  });

  // Characterises current behaviour (BUG-16, BUG-148, pinned; flips in PR A)
  it("leaves the confirm open after a refused delete and writes the error into the form behind it (BUG-148, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.fail(DELETE, IN_USE);
    const { onDeleted } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete skill" })).getByRole("button", {
        name: "Delete skill",
      })
    );

    expect(await screen.findByText("Quick Hands is known by 3 heroes.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete skill" })).not.toHaveTextContent(
      "known by 3 heroes"
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
