/**
 * The level-up skill picker (skill groups, phase 1a): a chip for each group in his skill access with
 * that group's skills under it (a skill in two of his groups under both), Show all for the rest,
 * greyed with the warning and still pickable, and the pick named with the group it comes through.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { skillGroup } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import SkillPicker from "./SkillPicker";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const skills = [
  { id: 1, name: "Strike to Injure", description: "Harder.", in_play: true },
  { id: 2, name: "Extra Tough", description: "Tough.", in_play: true },
  { id: 3, name: "Sprint", description: "Faster.", in_play: true },
  { id: 4, name: "Brick Wall", description: "Big.", in_play: true },
];
const groups = [
  skillGroup({ id: 10, name: "Combat", skill_ids: [1, 2] }),
  skillGroup({ id: 11, name: "Speed", skill_ids: [3] }),
  skillGroup({ id: 12, name: "Dwarves", for_everyone: false, skill_ids: [2] }),
  skillGroup({ id: 13, name: "Large Special", large_only: true, skill_ids: [4] }),
];
const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent ?? "");

describe("The skill picker", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /skills/?campaign_id=1", skills);
    fakeApi.on("GET /skill-groups/?campaign_id=1", groups);
  });

  it("shows a chip per group of his and a skill in two of them under both", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <SkillPicker campaignId={1} access={["Dwarves", "Combat"]} value={null} onChange={vi.fn()} />
    );

    expect(await screen.findByRole("option", { name: /Extra Tough/ })).toBeInTheDocument();
    expect(optionNames()).toEqual([expect.stringContaining("Extra Tough")]); // Dwarves first
    await user.click(screen.getByRole("button", { name: "Combat" }));
    expect(optionNames()).toEqual([
      expect.stringContaining("Strike to Injure"),
      expect.stringContaining("Extra Tough"),
    ]);
    expect(screen.queryByRole("button", { name: "Speed" })).not.toBeInTheDocument();
  });

  it("greys the rest behind Show all with the warnings, still pickable", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderWithQueryClient(
      <SkillPicker campaignId={1} access={["Combat"]} value={null} onChange={onChange} />
    );
    await screen.findByRole("option", { name: /Strike to Injure/ });

    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByRole("option", { name: /Sprint/ })).toHaveTextContent(
      "Not in his skill groups"
    );
    expect(screen.getByRole("option", { name: /Brick Wall/ })).toHaveTextContent(
      "For Large units only; this one isn't Large."
    );
    await user.click(screen.getByRole("option", { name: /Sprint/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("names the pick with the group it comes through for him", async () => {
    renderWithQueryClient(
      <SkillPicker
        campaignId={1}
        access={["Dwarves"]}
        value={{ id: 2, name: "Extra Tough", description: "Tough." }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByText("· Dwarves")).toBeInTheDocument();
  });
});
