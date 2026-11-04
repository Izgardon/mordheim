import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import RaceMaxWarning from "./RaceMaxWarning";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const human = {
  id: 2,
  name: "Human",
  movement: 4,
  weapon_skill: 6,
  ballistic_skill: 6,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 6,
  attacks: 4,
  leadership: 9,
};

describe("RaceMaxWarning", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /races/?campaign_id=1", [human]);
  });

  it("warns, as advances do, for each characteristic the form sets above his race's maximum", async () => {
    renderWithQueryClient(
      <RaceMaxWarning
        campaignId={1}
        raceId={2}
        draft={{ strength: "5", attacks: "5(2)", toughness: "4" }}
      />
    );
    expect(
      await screen.findByText("Above his race maximum: S 5 (max 4), A 5 (max 4)")
    ).toBeInTheDocument();
  });

  it("says nothing within the maximum or without a race", async () => {
    const { container } = renderWithQueryClient(
      <RaceMaxWarning campaignId={1} raceId={null} draft={{ strength: "9" }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
