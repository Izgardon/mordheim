import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewSkillDialog from "./NewSkillDialog";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeSkill, makeVeteranHero } from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({ updateWarbandHero: vi.fn(), getWarbandHeroDetail: vi.fn() }));
vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ warband: { campaign_id: 1 } }) }));
vi.mock("@/lib/catalogue-queries", () => ({
  useCatalogue: () => ({
    data: [makeSkill({ id: 205, name: "Strike to Injure", type: "Combat" })],
    isLoading: false,
    error: "",
  }),
}));

describe("NewSkillDialog", () => {
  it("hands back the hero its PATCH answered, with no GET after it", async () => {
    const user = setupUser();
    const pending = makeSkill({ id: 900, name: "New Skill", type: "Pending" });
    const hero = makeVeteranHero({ available_skills: ["Combat"], skills: [pending] });
    const saved = makeVeteranHero({
      skills: [makeSkill({ id: 205, name: "Strike to Injure", type: "Combat" })],
    });
    api.updateWarbandHero.mockResolvedValue(saved);
    const onHeroUpdated = vi.fn();
    renderWithQueryClient(
      <NewSkillDialog
        hero={hero}
        warbandId={9}
        open
        onOpenChange={vi.fn()}
        onHeroUpdated={onHeroUpdated}
      />
    );

    // Radix Select: open the skill list from the keyboard and take the first skill.
    const [, skillSelect] = await screen.findAllByRole("combobox");
    skillSelect.focus();
    await user.keyboard("{Enter}");
    await screen.findAllByRole("option");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Learn Skill" }));

    await waitFor(() => expect(onHeroUpdated).toHaveBeenCalledWith(saved));
    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, { skill_ids: [205] });
    expect(api.getWarbandHeroDetail).not.toHaveBeenCalled();
  });
});
