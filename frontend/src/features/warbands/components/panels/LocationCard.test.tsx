/**
 * A location's D6: the panel's card has the shared roll control's one box above Roll D6, rolled
 * there or typed in, then locked as Rolled beside the location's result for it; the Locations
 * page's card has no roll at all.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import LocationCard from "./LocationCard";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const well: CampaignLocation = {
  id: 6,
  campaign_id: 1,
  name: "The Well",
  area: "Old Town",
  content: "A shaft into the dark.",
  d6_1: "Nothing but echoes.",
  d6_2: "",
  d6_3: "",
  d6_4: "A rope, still knotted.",
  d6_5: "",
  d6_6: "A shard glints below.",
};

const show = (location: CampaignLocation, onPage = false) =>
  render(
    <LocationCard
      location={location}
      warbandId={1}
      heroes={[]}
      canSend={false}
      onPage={onPage}
      sending={false}
      onToggleSend={vi.fn()}
    />
  );

describe("LocationCard", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("rolls a D6 into its box above Roll D6, shows the result and locks as Rolled", async () => {
    const user = setupUser();
    show(well);
    const box = screen.getByLabelText("D6 rolled");
    expect(box.compareDocumentPosition(screen.getByRole("button", { name: "Roll D6" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    vi.mocked(rollDie).mockReturnValueOnce(4);
    await user.click(screen.getByRole("button", { name: "Roll D6" }));
    expect(rollDie).toHaveBeenCalledWith(6);
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("4");
    expect(screen.getByText("A rope, still knotted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rolled" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Roll D6" })).toBeNull();
  });

  it("takes the die rolled at the table, typed in its box", async () => {
    const user = setupUser();
    show(well);
    await user.type(screen.getByLabelText("D6 rolled"), "2");
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("2");
    expect(screen.getByText("Nothing listed for this roll.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rolled" })).toBeDisabled();
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("has no Roll D6 without results, nor on the Locations page", () => {
    const blank = { ...well, d6_1: "", d6_4: "", d6_6: "" };
    const { unmount } = show(blank);
    expect(screen.queryByRole("button", { name: "Roll D6" })).toBeNull();
    unmount();

    show(well, true);
    expect(screen.getByText("A shaft into the dark.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Roll/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
