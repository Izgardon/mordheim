/**
 * Settings → Rules → Warbands: the starting gold, the most heroes and hired swords and the hero
 * death roll, folded under their values; a departure from the preset is read while folded.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WarbandLimits from "./WarbandLimits";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({
  starting_gold: 500,
  max_heroes: 5,
  max_hired_swords: 3,
  hero_death_roll: "d66",
});
const patch = `PATCH /campaigns/${campaign.id}/`;

beforeEach(() => fakeApi.reset());

describe("Warbands", () => {
  it("is folded under its values, warning of a departure from the preset", async () => {
    fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, {
      preset_id: 2,
      preset_name: "Mutiny in Marienburg",
      sets: [
        {
          field: "max_heroes",
          label: "Most heroes",
          value: 6,
          text: "6",
          departure: "Mutiny in Marienburg sets Most heroes: 6.",
        },
      ],
      departures: [
        {
          field: "max_heroes",
          label: "Most heroes",
          message: "Mutiny in Marienburg sets Most heroes: 6.",
        },
      ],
    });
    renderWithQueryClient(<WarbandLimits campaign={campaign} />);

    const fold = screen.getByRole("button", { name: /^Warbands/ });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold).toHaveTextContent(
      "500 gc to start · Up to 5 heroes and 3 hired swords · D66 death roll"
    );
    const lines = await screen.findAllByText("Mutiny in Marienburg sets Most heroes: 6.");
    expect(lines.filter((line) => !line.closest("[hidden]"))).toHaveLength(1);
  });

  it("opens to the limits and saves them", async () => {
    const user = setupUser();
    fakeApi.on(patch, (body: object) => ({ ...campaign, ...body }));
    renderWithQueryClient(<WarbandLimits campaign={campaign} />);
    await user.click(screen.getByRole("button", { name: /^Warbands/ }));

    const heroes = screen.getByRole("spinbutton", { name: "Most heroes" });
    await user.clear(heroes);
    await user.type(heroes, "7");
    await user.click(screen.getAllByRole("button", { name: "Save" })[1]);

    await waitFor(() =>
      expect(fakeApi.bodyOf(patch)).toEqual({ max_heroes: 7, max_hired_swords: 3 })
    );
  });
});
