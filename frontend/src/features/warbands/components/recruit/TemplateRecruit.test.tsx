/**
 * A group recruited from the list names each of its models in the first form (William, 28 Nov
 * 2026: "when recruiting henchmen from a list i should be able to set their names in that initial
 * form"): a field per model following Models, each needing a name before Recruit sends, and a
 * creature's starting as a bought beast's do ("Giant Rat 1").
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { TemplateFighter } from "../../types/hire-template-types";
import TemplateRecruit from "./TemplateRecruit";

const henchman = (extra: Partial<TemplateFighter> = {}) =>
  ({
    id: 1,
    key: "warriors",
    kind: "henchman",
    name: "Warrior",
    plural: "Warriors",
    race_id: 1,
    race: "Human",
    cost: 25,
    starting_xp: 0,
    min_count: 0,
    max_count: null,
    group_min: 1,
    group_max: 5,
    movement: 4,
    weapon_skill: 3,
    ballistic_skill: 3,
    strength: 3,
    toughness: 3,
    wounds: 1,
    initiative: 3,
    attacks: 1,
    leadership: 7,
    written_stats: {},
    skill_types: [],
    spell_types: [],
    gains_xp: true,
    promotable: true,
    is_leader: false,
    caster: "No",
    spell_picks: null,
    large: false,
    fixed_kit: "",
    lists: [],
    rules: [],
    skills: [],
    spells: [],
    have: { count: 0, groups: 0 },
    off_lines: [],
    off_upgrades: [],
    free_items: [],
    ...extra,
  }) satisfies TemplateFighter;

function show(fighter: TemplateFighter) {
  const onRecruit = vi.fn();
  renderWithQueryClient(
    <TemplateRecruit
      fighter={fighter}
      lists={[]}
      listPricesOpen={false}
      gold={500}
      saving={false}
      onRecruit={onRecruit}
      onCancel={vi.fn()}
    />
  );
  return onRecruit;
}

const nameFields = () => screen.getAllByRole("textbox", { name: /^Model \d+$/ });

describe("Naming a group's models as it is recruited from the list", () => {
  it("gives a name field per model, following Models", async () => {
    show(henchman());
    const user = setupUser();
    expect(nameFields()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(nameFields()).toHaveLength(3);
    expect(screen.getByLabelText("Model 3")).toHaveValue("");

    await user.type(screen.getByLabelText("Model 3"), "Kurt");
    await user.click(screen.getByRole("button", { name: "Less" }));
    expect(nameFields()).toHaveLength(2);
    expect(screen.queryByLabelText("Model 3")).toBeNull();
  });

  it("says a name is needed under each blank one, and sends none until they are named", async () => {
    const onRecruit = show(henchman({ group_min: 2 }));
    const user = setupUser();
    await user.type(screen.getByLabelText("Group name"), "The Bravos");
    await user.type(screen.getByLabelText("Model 1"), "Otto");
    await user.click(screen.getByRole("button", { name: "Recruit" }));

    expect(screen.getAllByText("Name is needed.")).toHaveLength(1);
    expect(screen.getByLabelText("Model 2")).toHaveFocus();
    expect(screen.getByLabelText("Model 2")).toHaveAttribute("aria-invalid", "true");
    expect(onRecruit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Model 2"), "  Hans ");
    expect(screen.queryByText("Name is needed.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    expect(onRecruit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "The Bravos", members: ["Otto", "  Hans "] })
    );
  });

  it("puts the cursor in the group's name first when both are blank", async () => {
    const onRecruit = show(henchman());
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    expect(screen.getAllByText("Name is needed.")).toHaveLength(2);
    expect(screen.getByLabelText("Group name")).toHaveFocus();
    expect(onRecruit).not.toHaveBeenCalled();
  });

  it("starts a creature's models on its name and number, each still editable", async () => {
    const rat = henchman({
      key: "giant-rats",
      name: "Giant Rat",
      rules: [{ id: 3, name: "Animal", kind: "trait", category: "body", description: "" }],
    });
    const onRecruit = show(rat);
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByLabelText("Model 2")).toHaveValue("Giant Rat 2");

    await user.clear(screen.getByLabelText("Model 1"));
    await user.type(screen.getByLabelText("Model 1"), "Squeak");
    await user.type(screen.getByLabelText("Group name"), "The Pack");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    expect(onRecruit).toHaveBeenCalledWith(
      expect.objectContaining({ members: ["Squeak", "Giant Rat 2"] })
    );
  });

  it("asks a hero for his name alone", () => {
    show(henchman({ kind: "hero", group_min: null, group_max: null }));
    expect(screen.queryByRole("list", { name: "Names" })).toBeNull();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});
