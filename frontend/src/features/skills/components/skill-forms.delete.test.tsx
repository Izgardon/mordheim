/**
 * Deleting a custom skill from the Skills page's form (`AddSkillForm`) and from the warband pages'
 * dialog (`SkillFormDialog`, whose edit mode no screen opens today): the confirm asks `usage/`
 * first and says what will happen (decision 5, CAT-TWEAK-04): unused, the skill is deleted; known
 * by units, it is archived and they keep it. A refused delete's reason shows in the confirm
 * (BUG-148).
 */
import { screen, waitFor, within } from "@testing-library/react";
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
const USAGE = "GET /skills/900/usage/";
const UNUSED = { units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 };
const IN_USE = { units: 3, warbands: 2, stashes: 0, bestiary_entries: 1 };
/** A refusal the confirm must show: the entry became a version since the list was read. */
const USE_REVERT_DETAIL =
  "This entry is (or has) the campaign's version of a book entry: revert it instead of deleting it.";
const USE_REVERT = new ApiError(USE_REVERT_DETAIL, 409, {
  detail: USE_REVERT_DETAIL,
  code: "use_revert",
  fields: {},
});

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
  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    renderForm(clientWithSkills(), false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  function renderForm(queryClient = clientWithSkills(), canDelete = true) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <AddSkillForm
        campaignId={1}
        editingSkill={quickHands}
        canDelete={canDelete}
        typeOptions={["Combat", "Speed"]}
        onCreated={vi.fn()}
        onDeleted={onDeleted}
        onCancel={vi.fn()}
      />,
      { queryClient }
    );
    return { onDeleted, queryClient };
  }

  it("asks what uses it first; nothing does, so the confirm says it is deleted for good, then one DELETE (BUG-16, CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.on(DELETE, null);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    expect(
      await within(confirm).findByText(
        "Delete Quick Hands? Nothing uses it, so it is deleted for good."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(900));
    expect(fakeApi.calls()).toEqual([USAGE, DELETE]);
    expect(cachedNames(queryClient)).toEqual(["Strike to Injure"]);
    expect(queryClient.getQueryState(SKILLS_KEY)?.isInvalidated).toBe(true);
  });

  it("archives a skill units know: the confirm says what holds it and that they keep it (CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, IN_USE);
    fakeApi.on(DELETE, { outcome: "archived", usage: IN_USE });
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    expect(
      await within(confirm).findByText(
        "Archive Quick Hands? It is used by 3 units in 2 warbands, and by 1 bestiary entry; they keep their copies. It leaves the shops and pickers, and you can restore it from Archived."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Archive skill" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(900));
    expect(cachedNames(queryClient)).toEqual(["Strike to Injure"]);
  });

  it("shows a refused delete's reason in the confirm, which stays open with the entry still listed, and nothing in the form behind it (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.fail(DELETE, USE_REVERT);
    const { onDeleted, queryClient } = renderForm();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    await within(confirm).findByText(/deleted for good/);
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(USE_REVERT_DETAIL);
    expect(screen.getByRole("dialog", { name: "Delete skill" })).toContainElement(reason);
    expect(screen.getAllByText(USE_REVERT_DETAIL)).toHaveLength(1);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(cachedNames(queryClient)).toContain("Quick Hands");
  });
});

describe("SkillFormDialog (edit mode): Delete", () => {
  it("offers no Delete to someone without delete_catalogue (decision 5)", async () => {
    await openDialog(setupUser(), clientWithSkills(), false);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });

  async function openDialog(
    user: ReturnType<typeof setupUser>,
    queryClient = clientWithSkills(),
    canDelete = true
  ) {
    const onDeleted = vi.fn();
    renderWithQueryClient(
      <SkillFormDialog
        mode="edit"
        canDelete={canDelete}
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

  it("asks what uses it first and says it is deleted for good, then sends one DELETE (BUG-16, CAT-TWEAK-04)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.on(DELETE, null);
    const { onDeleted, queryClient } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    expect(
      await within(confirm).findByText(
        "Delete Quick Hands? Nothing uses it, so it is deleted for good."
      )
    ).toBeVisible();
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(900));
    expect(fakeApi.calls()).toEqual([USAGE, DELETE]);
    // The skill's own campaign_id names the cached list it leaves.
    expect(cachedNames(queryClient)).toEqual(["Strike to Injure"]);
  });

  it("shows a refused delete's reason in the confirm, which stays open (BUG-148)", async () => {
    const user = setupUser();
    fakeApi.on(USAGE, UNUSED);
    fakeApi.fail(DELETE, USE_REVERT);
    const { onDeleted } = await openDialog(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("dialog", { name: "Delete skill" });
    await within(confirm).findByText(/deleted for good/);
    await user.click(within(confirm).getByRole("button", { name: "Delete skill" }));

    const reason = await screen.findByRole("alert");
    expect(reason).toHaveTextContent(USE_REVERT_DETAIL);
    expect(screen.getByRole("dialog", { name: "Delete skill" })).toContainElement(reason);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
