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

const show = () =>
  render(
    <LocationCard
      location={well}
      warbandId={1}
      heroes={[]}
      canSend={false}
      sending={false}
      onToggleSend={vi.fn()}
    />
  );

describe("LocationCard", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("reads the D6 typed in as it reads the roll, and Roll again replaces it", async () => {
    const user = setupUser();
    show();
    await user.type(screen.getByLabelText("D6 rolled"), "4");
    expect(screen.getByText("A rope, still knotted.")).toBeInTheDocument();
    expect(rollDie).not.toHaveBeenCalled();

    vi.mocked(rollDie).mockReturnValueOnce(6);
    await user.click(screen.getByRole("button", { name: "Roll again" }));
    expect(screen.getByText("A shard glints below.")).toBeInTheDocument();
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("6");

    await user.clear(screen.getByLabelText("D6 rolled"));
    expect(screen.queryByText("A shard glints below.")).toBeNull();
    expect(screen.getByRole("button", { name: "Roll D6" })).toBeInTheDocument();
  });
});
