/**
 * A location's D6 (William, 7 Nov 2026: "in the side draw just have a Roll d6 button, dont need the
 * d6 roll pill there"): the panel's card rolls with one Roll D6 button and has no roll boxes; the
 * Locations page's card has no roll at all.
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

  it("rolls a D6 with one button, with no roll boxes, and Roll D6 again replaces the result", async () => {
    const user = setupUser();
    show(well);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("D6 roll")).toBeNull();

    vi.mocked(rollDie).mockReturnValueOnce(4);
    await user.click(screen.getByRole("button", { name: "Roll D6" }));
    expect(rollDie).toHaveBeenCalledWith(6);
    expect(screen.getByText("A rope, still knotted.")).toBeInTheDocument();

    vi.mocked(rollDie).mockReturnValueOnce(2);
    await user.click(screen.getByRole("button", { name: "Roll D6" }));
    expect(screen.queryByText("A rope, still knotted.")).toBeNull();
    expect(screen.getByText("Nothing listed for this roll.")).toBeInTheDocument();
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
