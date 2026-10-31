import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarbandTypeRow } from "../../types/warband-types";
import WarbandTypePicker from "./WarbandTypePicker";

const row = (
  id: number,
  name: string,
  overrides: Partial<WarbandTypeRow> = {}
): WarbandTypeRow => ({
  id,
  name,
  slug: name.toLowerCase().replace(/ /g, "-"),
  campaign_id: null,
  setting: { id: 1, slug: "mordheim", name: "Mordheim", grade: "1a" },
  source: "Mordheim Rulebook",
  link_url: `https://mordheimer.example/${id}`,
  groups: [],
  race: "",
  source_code: "MHR",
  broheim_grade: "1a",
  mordheimer_grade: "core",
  in_play: true,
  ...overrides,
});

const TYPES = [
  row(1, "Skaven", { race: "Skaven" }),
  row(2, "Skaven of Clan Pestilens", {
    race: "Skaven",
    setting: { id: 13, slug: "mousillon", name: "Mousillon", grade: "2b" },
    source: "Mousillon",
    in_play: false,
  }),
  row(3, "Reiklanders"),
];
const mutateAsync = vi.fn();

vi.mock("../../api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: TYPES, isLoading: false }),
  useAddWarbandType: () => ({ mutateAsync, isPending: false }),
}));

describe("WarbandTypePicker", () => {
  beforeEach(() => mutateAsync.mockReset());

  it("lists the types in play first and the rest greyed out with a warning, still pickable", async () => {
    const onPick = vi.fn();
    render(<WarbandTypePicker id="type" campaignId={4} value={null} onPick={onPick} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "skav");

    const inPlay = screen.getByRole("list", { name: "Warband types in this campaign" });
    expect(
      within(inPlay)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Skaven1aMordheim · Mordheim Rulebook"]);
    const outside = screen.getByRole("list", { name: "Warband types outside this campaign" });
    expect(within(outside).getByText("Mousillon isn't in this campaign")).toBeInTheDocument();
    await user.click(within(outside).getByRole("button"));
    expect(onPick).toHaveBeenCalledWith(TYPES[1]);
  });

  it("adds a name no type has as the campaign's own type and picks it", async () => {
    const onPick = vi.fn();
    const added = row(9, "Gutter Kings", { campaign_id: 4, setting: null, source: "" });
    mutateAsync.mockResolvedValue(added);
    render(<WarbandTypePicker id="type" campaignId={4} value={null} onPick={onPick} />);
    await userEvent.type(screen.getByRole("textbox"), "Gutter Kings");
    await userEvent.click(
      screen.getByRole("button", { name: "Add “Gutter Kings” as a custom warband type" })
    );
    expect(mutateAsync).toHaveBeenCalledWith({ name: "Gutter Kings" });
    expect(onPick).toHaveBeenCalledWith(added);
  });

  it("shows the type picked with Change", async () => {
    render(<WarbandTypePicker id="type" campaignId={4} value={TYPES[1]} onPick={vi.fn()} />);
    expect(screen.getByText("Mousillon isn't in this campaign")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});
