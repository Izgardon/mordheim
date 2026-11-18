/**
 * The battle Rules sheet's Warband rules (the templates plan): each warband in the battle with its
 * rules as pills, a pill opening its text in the sheet itself and never a modal on top of it
 * (William, 12 Nov 2026); a warband with none is left out.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import BattleWarbandRules from "./BattleWarbandRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const render = () =>
  renderWithQueryClient(
    <BattleWarbandRules
      campaignId={3}
      warbands={[
        { id: 1, name: "Grudgebearers" },
        { id: 2, name: "Rats" },
      ]}
    />
  );

describe("BattleWarbandRules", () => {
  beforeEach(() => fakeApi.reset());

  it("opens a rule in the sheet, not in a modal over it", async () => {
    fakeApi.on("GET /warbands/1/rules/", [
      { id: 5, title: "Hard Head", description: "Maces." },
      { id: 6, title: "Stubborn", description: "No rout." },
    ]);
    fakeApi.on("GET /warbands/2/rules/", []);
    render();
    const user = setupUser();

    expect(await screen.findByText("Grudgebearers")).toBeInTheDocument();
    expect(screen.queryByText("Rats")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Hard Head" }));
    expect(screen.getByRole("article", { name: "Hard Head" })).toHaveTextContent("Maces.");
    expect(screen.queryByRole("dialog")).toBeNull();

    // another pill swaps the text, and the same pill again closes it
    await user.click(screen.getByRole("button", { name: "Stubborn" }));
    expect(screen.queryByRole("article", { name: "Hard Head" })).toBeNull();
    expect(screen.getByRole("article", { name: "Stubborn" })).toHaveTextContent("No rout.");

    await user.click(screen.getByRole("button", { name: "Stubborn" }));
    expect(screen.queryByRole("article", { name: "Stubborn" })).toBeNull();
  });

  it("says so while nobody has a rule", async () => {
    fakeApi.on("GET /warbands/1/rules/", []);
    fakeApi.on("GET /warbands/2/rules/", []);
    render();

    expect(await screen.findByText("No warband rules.")).toBeInTheDocument();
  });
});
