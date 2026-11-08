/**
 * The Edit form's notes take no room until its Notes button opens them (William, 8 Nov 2026:
 * "edit form should have a button to edit the notes rather than taking up room normally"); the
 * button shows a dot when he has some, and the notes save with the form.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import EditUnitForm from "./EditUnitForm";
import type { RosterUnit } from "./unit-view";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

const renderForm = (entry: RosterUnit) => {
  const onClose = vi.fn();
  renderWithQueryClient(
    <EditUnitForm
      entry={entry}
      campaign={null}
      campaignId={1}
      warbandId={9}
      canCreateRace={false}
      onAddItem={vi.fn()}
      onClose={onClose}
    />
  );
  return { onClose };
};

type Batch = { update: Record<string, unknown>[] };

describe("The Edit form's notes", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("POST /warbands/9/heroes/batch/", { units: [], summary: {} });
    fakeApi.on("POST /warbands/9/henchmen-groups/batch/", { units: [], summary: {} });
  });

  it("take no room until the Notes button opens them", async () => {
    const user = setupUser();
    renderForm({ kind: "hero", unit: makeHero({ id: 5 }) });

    expect(screen.queryByRole("textbox", { name: "Notes" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Notes" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);

    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("are written into the box and saved with the form", async () => {
    const user = setupUser();
    const { onClose } = renderForm({ kind: "hero", unit: makeHero({ id: 5 }) });

    await user.click(screen.getByRole("button", { name: "Notes" }));
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "Owes Grukk 5 gc.");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("textbox", { name: "Notes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notes (written)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    const body = fakeApi.bodyOf("POST /warbands/9/heroes/batch/") as Batch;
    expect(body.update[0]).toMatchObject({ id: 5, notes: "Owes Grukk 5 gc." });
    expect(onClose).toHaveBeenCalled();
  });

  it("show the unit's own, which can be cleared, for a henchmen group too", async () => {
    const user = setupUser();
    const group = makeVeteranHenchmenGroup({ notes: "Guard the well." });
    renderForm({ kind: "henchmen_group", unit: group });

    await user.click(screen.getByRole("button", { name: "Notes (written)" }));
    const box = screen.getByRole("textbox", { name: "Notes" });
    expect(box).toHaveValue("Guard the well.");
    expect(box).toHaveAttribute("maxLength", "2000");

    await user.clear(box);
    await user.click(screen.getByRole("button", { name: "Save" }));

    const body = fakeApi.bodyOf("POST /warbands/9/henchmen-groups/batch/") as Batch;
    expect(body.update[0]).toMatchObject({ id: group.id, notes: "" });
  });
});

/**
 * Beside the profile, skill access's pills sit on the stat boxes' line (William, 8 Nov 2026: "can
 * we also align the pills here on these lines"): the two captions alike, a blank line as tall as
 * the boxes' labels over the pills while the two sit side by side, and pills as tall as the boxes.
 */
describe("The Edit form's profile and skill access", () => {
  beforeEach(() => fakeApi.reset());

  it("line up, caption by caption and the pills on the boxes' line", () => {
    renderForm({ kind: "hero", unit: makeHero({ id: 5, available_skills: [] }) });

    const caption = screen.getByText("Skill access");
    expect(screen.getByText("Profile")).toHaveClass(...caption.className.split(" "));

    const pills = screen.getByRole("group", { name: "Skill access" });
    const space = pills.previousElementSibling as HTMLElement;
    const label = screen.getByText("WS");
    expect(space).toHaveAttribute("aria-hidden", "true");
    expect(space).toHaveClass("hidden", "min-[720px]:flex", "gap-0.5");
    expect(label).toHaveClass("gap-0.5", "text-[10px]", "leading-[15px]");
    expect(space.firstElementChild).toHaveClass("text-[10px]", "leading-[15px]");

    const box = screen.getByRole("textbox", { name: "WS for Captain Aldric" });
    expect(box).toHaveClass("h-8", "md:h-9");
    for (const pill of within(pills).getAllByRole("button")) {
      expect(pill).toHaveClass("min-h-8", "md:min-h-9");
    }
  });
});
