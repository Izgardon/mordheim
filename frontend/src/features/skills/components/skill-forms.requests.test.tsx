/**
 * The bodies the skill forms send, as the server receives them: `AddSkillForm` (the Skills page;
 * its edit PATCH is pinned in `Skills.permissions.test.tsx`) and `SkillFormDialog` (the warband
 * pages create with it; its edit mode has no caller). The baseline for PR A's server-side
 * validation and `edit_catalogue`.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { quickHands, skill } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AddSkillForm from "./AddSkillForm";
import SkillFormDialog from "./SkillFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const created = skill({ id: 906, campaign_id: 1, name: "Dirty Tricks", type: "Speed" });

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST /skills/", created);
  fakeApi.on("PATCH /skills/900/", (body: object) => ({ ...quickHands, ...body }));
});

describe("AddSkillForm: create", () => {
  function renderForm() {
    renderWithQueryClient(
      <AddSkillForm
        campaignId={1}
        typeOptions={["Combat", "Speed"]}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    );
  }

  it("POSTs name, the chosen list, description and campaign_id, trimmed", async () => {
    const user = setupUser();
    renderForm();

    await user.type(screen.getByPlaceholderText("Quick Hands"), "  Dirty Tricks ");
    await user.click(screen.getByPlaceholderText("Search or add a list"));
    await user.click(screen.getByRole("button", { name: "Speed" }));
    await user.type(screen.getByPlaceholderText("Describe the skill."), "Sand in the eyes.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.calls()).toEqual(["POST /skills/"]);
    expect(fakeApi.bodyOf("POST /skills/")).toEqual({
      name: "Dirty Tricks",
      type: "Speed",
      description: "Sand in the eyes.",
      campaign_id: 1,
    });
  });

  it("sends a list added on the spot as the type", async () => {
    const user = setupUser();
    renderForm();

    await user.type(screen.getByPlaceholderText("Quick Hands"), "Gutter Run");
    await user.type(screen.getByPlaceholderText("Search or add a list"), "Gutter");
    await user.click(screen.getByRole("button", { name: "Add custom list" }));
    await user.type(screen.getByPlaceholderText("Describe the skill."), "Runs the gutters.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.bodyOf("POST /skills/")).toMatchObject({ name: "Gutter Run", type: "Gutter" });
  });

  it("sends nothing while the typed list is neither chosen nor added", async () => {
    const user = setupUser();
    renderForm();

    await user.type(screen.getByPlaceholderText("Quick Hands"), "Gutter Run");
    await user.type(screen.getByPlaceholderText("Search or add a list"), "Gutter");
    await user.type(screen.getByPlaceholderText("Describe the skill."), "Runs the gutters.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Add or select a type before saving.")).toBeVisible();
    expect(fakeApi.calls()).toEqual([]);
  });
});

describe("SkillFormDialog", () => {
  it("create: POSTs the same body as AddSkillForm", async () => {
    const user = setupUser();
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

    await user.type(within(dialog).getByLabelText("Name"), "Dirty Tricks");
    await user.click(within(dialog).getByPlaceholderText("Search or add a list"));
    await user.click(within(dialog).getByRole("button", { name: "Speed" }));
    await user.type(within(dialog).getByLabelText("Description"), "Sand in the eyes.");
    await user.click(within(dialog).getByRole("button", { name: "Add skill" }));

    expect(fakeApi.bodyOf("POST /skills/")).toEqual({
      name: "Dirty Tricks",
      type: "Speed",
      description: "Sand in the eyes.",
      campaign_id: 1,
    });
  });

  it("edit: PATCHes name, type and description, with no campaign_id", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <SkillFormDialog
        mode="edit"
        skill={quickHands}
        typeOptions={["Combat", "Speed"]}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Edit skill" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Skill" });

    await user.clear(within(dialog).getByLabelText("Description"));
    await user.type(within(dialog).getByLabelText("Description"), "Faster still.");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(fakeApi.bodyOf("PATCH /skills/900/")).toEqual({
      name: "Quick Hands",
      type: "Speed",
      description: "Faster still.",
    });
  });
});
