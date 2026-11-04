/**
 * The Edit form's skill access (skill groups, phase 1a): the core groups, then Special with the
 * campaign's other groups, those open to his warband first; a group is stored by its access name,
 * so a campaign's renamed version of a book group still answers to it.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { skillGroup } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import SkillAccessField from "./SkillAccessField";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const groups = [
  skillGroup({ id: 10, name: "Close Combat", access_name: "Combat", replaces: 1 }),
  skillGroup({ id: 11, name: "Animal", skill_ids: [1, 2] }),
  skillGroup({ id: 12, name: "Dwarves", for_everyone: false, skill_ids: [3] }),
];

describe("Skill access", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /skill-groups/?campaign_id=1", groups);
    fakeApi.on("GET /warbands/7/who-can/", {
      items: [],
      hired_swords: [],
      dramatis_personae: [],
      skill_group_ids: [10, 12],
      special_skill_ids: [3],
    });
  });

  it("offers the core groups, then the special ones open to his warband first", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderWithQueryClient(
      <SkillAccessField
        campaignId={1}
        warbandId={7}
        value={{ C: false, Spc: true, Gone: true }}
        onChange={onChange}
      />
    );

    const chips = screen.getByRole("group", { name: "Skill access" });
    expect(await within(chips).findByRole("button", { name: "Close Combat" })).toBeInTheDocument();
    expect(screen.getByText("Gone")).toBeInTheDocument(); // a name no group answers to stays, to remove
    await user.click(screen.getByRole("button", { name: "Choose a special skill group" }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining("Dwarves"),
      expect.stringContaining("Animal"),
    ]);
    await user.click(options[1]);
    expect(onChange).toHaveBeenLastCalledWith({ C: false, Spc: true, Gone: true, Animal: true });
  });
});
