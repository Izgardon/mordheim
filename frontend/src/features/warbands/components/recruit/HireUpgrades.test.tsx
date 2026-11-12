/**
 * Upgrades in the hire dialog (the templates plan, phase 3): a hero's template upgrades by group,
 * before and after the first battle; a pick is a tally line at its price, the second and later of
 * a doubling group at double (and back when the first goes), past a group's most it warns, one he
 * isn't meant to take is dimmed with its reason, and the hire sends what the tally says.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import {
  makeTemplateAnswer,
  makeTemplateFighter,
  makeTemplateUpgrade,
} from "@/test/template-fixtures";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import RecruitForm from "../roster/RecruitForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/warband-cache")>()),
  useWarbandCacheUpdate: () => () => undefined,
}));

const doubling = { later_double: true, at_recruit: true };
const marks = { group: "Mark of the Dark Gods", max_per_fighter: 1 };
const answer = makeTemplateAnswer(
  {
    fighters: [
      makeTemplateFighter("chieftain", "Chieftain", { cost: 50, lists: [], off_upgrades: [4] }),
      makeTemplateFighter("marauders", "Marauder", { kind: "henchman", lists: [] }),
    ],
    upgrades: [
      makeTemplateUpgrade(1, "Great Claw", 50, { ...doubling, later_cost: 100 }),
      makeTemplateUpgrade(2, "Tentacle", 35, { ...doubling, later_cost: 70 }),
      makeTemplateUpgrade(3, "Mark of Tchar", 0, marks),
      makeTemplateUpgrade(4, "Mark of Arkhar", 0, { ...marks, who_text: "Seers only" }),
    ],
  },
  { list_prices_open: false }
);

function renderForm(kind: "hero" | "henchmen_group" = "hero") {
  renderWithQueryClient(
    <RecruitForm
      kind={kind}
      campaignId={1}
      warbandId={9}
      typeName="Marauders of Chaos"
      gold={200}
      existingIds={[]}
      canCreateRace={false}
      onCancel={vi.fn()}
      onCreated={vi.fn()}
    />
  );
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/9/template/", answer);
  fakeApi.on("POST /warbands/9/heroes/batch/", {
    units: [makeHero({ id: 3, name: "Kurt" })],
    summary: {},
    warnings: [],
  });
});

describe("Upgrades in the hire dialog", () => {
  it("prices the second of a doubling group at double, warns past a group's most and sends the tally", async () => {
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Chieftain/ }));
    const mutations = screen.getByRole("group", { name: "Mutations" });
    await user.click(within(mutations).getByRole("button", { name: "Tentacle 35 gc" }));
    expect(
      within(mutations).getByRole("button", { name: "Great Claw 100 gc" })
    ).toBeInTheDocument();
    await user.click(within(mutations).getByRole("button", { name: "Great Claw 100 gc" }));
    const tally = screen.getByRole("list", { name: "Tally" });
    expect(within(tally).getByLabelText("Price for Great Claw")).toHaveValue(100);

    // the first goes: the second, not edited, is the first now
    await user.click(within(mutations).getByRole("button", { name: "Tentacle 35 gc" }));
    expect(within(tally).getByLabelText("Price for Great Claw")).toHaveValue(50);

    const theMarks = screen.getByRole("group", { name: "Mark of the Dark Gods" });
    expect(within(theMarks).getByRole("button", { name: /Mark of Arkhar/ })).toHaveTextContent(
      "(Seers only)"
    );
    await user.click(within(theMarks).getByRole("button", { name: "Mark of Tchar free" }));
    await user.click(within(theMarks).getByRole("button", { name: /Mark of Arkhar/ }));
    expect(
      within(tally).getByText("At most 1 from Mark of the Dark Gods: he would have 2.")
    ).toBeInTheDocument();
    expect(screen.getByText("Gold 200 → 100 gc")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toEqual({
        create: [{ fighter_key: "chieftain", name: null, price: 50 }],
        upgrades: [
          { create_index: 0, upgrade_id: 1, price: 50 },
          { create_index: 0, upgrade_id: 3, price: 0 },
          { create_index: 0, upgrade_id: 4, price: 0 },
        ],
      })
    );
  });

  it("has no upgrades for a group", async () => {
    renderForm("henchmen_group");
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Marauder/ }));
    expect(screen.queryByText("Upgrades")).toBeNull();
  });
});
