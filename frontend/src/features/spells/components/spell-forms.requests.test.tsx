/**
 * The bodies the spell forms send, as the server receives them: `AddSpellForm` (the Spells page's
 * Add and Edit) and `CreateSpellDialog` (the warband pages' Add spell). The baseline for PR A's
 * server-side validation and `edit_catalogue`.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { gutterHex, spell } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import AddSpellForm from "./AddSpellForm";
import CreateSpellDialog from "./CreateSpellDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const created = spell({ id: 951, campaign_id: 1, name: "Rat Swarm" });

/** As the API answers: a spell's dc is text, so a blank difficulty is "" and a null dc is a 400. */
const refusingNullDc =
  (answer: (body: object) => unknown) =>
  (body: { dc?: unknown }): unknown => {
    if (body.dc === null) {
      throw new ApiError("Bad Request", 400, { dc: ["This field may not be null."] });
    }
    return answer(body);
  };

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST /spells/", created);
  fakeApi.on("PATCH /spells/950/", (body: object) => ({ ...gutterHex, ...body }));
});

describe("AddSpellForm", () => {
  it("create: POSTs name, class, description, dc and roll as numbers, and campaign_id", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <AddSpellForm
        campaignId={1}
        typeOptions={["Lesser Magic"]}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Fireball"), "Rat Swarm");
    await user.click(screen.getByPlaceholderText("Search or add a class"));
    await user.click(screen.getByRole("button", { name: "Lesser Magic" }));
    await user.type(screen.getByPlaceholderText("0"), "9");
    await chooseOption(user, screen.getByText("Select roll").closest("button")!, "3");
    await user.type(screen.getByPlaceholderText("Describe the spell."), "Rats. Everywhere.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.calls()).toEqual(["POST /spells/"]);
    expect(fakeApi.bodyOf("POST /spells/")).toEqual({
      name: "Rat Swarm",
      type: "Lesser Magic",
      description: "Rats. Everywhere.",
      dc: 9,
      roll: 3,
      campaign_id: 1,
    });
  });

  it("create: a blank difficulty is sent as an empty dc, which the API accepts, and roll as null", async () => {
    fakeApi.on(
      "POST /spells/",
      refusingNullDc(() => created)
    );
    const onCreated = vi.fn();
    const user = setupUser();
    renderWithQueryClient(
      <AddSpellForm
        campaignId={1}
        typeOptions={["Lesser Magic"]}
        onCreated={onCreated}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Fireball"), "Rat Swarm");
    await user.click(screen.getByPlaceholderText("Search or add a class"));
    await user.click(screen.getByRole("button", { name: "Lesser Magic" }));
    await user.type(screen.getByPlaceholderText("Describe the spell."), "Rats.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.bodyOf("POST /spells/")).toMatchObject({ dc: "", roll: null });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(screen.queryByText(/may not be null/)).not.toBeInTheDocument();
  });

  it("edit: clearing the difficulty sends an empty dc, which the API accepts", async () => {
    fakeApi.on(
      "PATCH /spells/950/",
      refusingNullDc((body) => ({ ...gutterHex, ...body }))
    );
    const onUpdated = vi.fn();
    const user = setupUser();
    renderWithQueryClient(
      <AddSpellForm
        campaignId={1}
        editingSpell={gutterHex}
        typeOptions={["Lesser Magic"]}
        onCreated={vi.fn()}
        onUpdated={onUpdated}
        onCancel={vi.fn()}
      />
    );

    await user.clear(screen.getByPlaceholderText("0"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fakeApi.bodyOf("PATCH /spells/950/")).toMatchObject({ dc: "" });
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 950, dc: "" }));
  });

  it("edit: PATCHes every field with dc and roll, and no campaign_id", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <AddSpellForm
        campaignId={1}
        editingSpell={gutterHex}
        typeOptions={["Lesser Magic"]}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const name = screen.getByDisplayValue("Gutter Hex");
    await user.clear(name);
    await user.type(name, "Gutter Curse");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fakeApi.bodyOf("PATCH /spells/950/")).toEqual({
      name: "Gutter Curse",
      type: "Lesser Magic",
      description: "The cobbles curse your enemy.",
      dc: 8,
      roll: 2,
    });
  });
});

describe("CreateSpellDialog", () => {
  it("create: POSTs the same body as AddSpellForm", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <CreateSpellDialog campaignId={1} typeOptions={["Lesser Magic"]} onCreated={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: "Add spell" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Fireball"), "Rat Swarm");
    await user.click(within(dialog).getByPlaceholderText("Search or add a class"));
    await user.click(within(dialog).getByRole("button", { name: "Lesser Magic" }));
    await user.type(within(dialog).getByPlaceholderText("0"), "9");
    await user.type(within(dialog).getByPlaceholderText("Describe the spell."), "Rats.");
    await user.click(within(dialog).getByRole("button", { name: "Add spell" }));

    expect(fakeApi.bodyOf("POST /spells/")).toEqual({
      name: "Rat Swarm",
      type: "Lesser Magic",
      description: "Rats.",
      dc: 9,
      roll: null,
      campaign_id: 1,
    });
  });

  it("create: a blank difficulty is sent as an empty dc, which the API accepts", async () => {
    fakeApi.on(
      "POST /spells/",
      refusingNullDc(() => created)
    );
    const onCreated = vi.fn();
    const user = setupUser();
    renderWithQueryClient(
      <CreateSpellDialog campaignId={1} typeOptions={["Lesser Magic"]} onCreated={onCreated} />
    );
    await user.click(screen.getByRole("button", { name: "Add spell" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Fireball"), "Rat Swarm");
    await user.click(within(dialog).getByPlaceholderText("Search or add a class"));
    await user.click(within(dialog).getByRole("button", { name: "Lesser Magic" }));
    await user.type(within(dialog).getByPlaceholderText("Describe the spell."), "Rats.");
    await user.click(within(dialog).getByRole("button", { name: "Add spell" }));

    expect(fakeApi.bodyOf("POST /spells/")).toMatchObject({ dc: "", roll: null });
    expect(onCreated).toHaveBeenCalledWith(created);
  });
});
