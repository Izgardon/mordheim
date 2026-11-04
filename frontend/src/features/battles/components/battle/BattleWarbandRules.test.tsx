/**
 * The battle Rules sheet's Warband rules (the templates plan): each warband in the battle with its
 * rules as pills, opening the rules modal to read; a warband with none is left out.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import BattleWarbandRules from "./BattleWarbandRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

describe("BattleWarbandRules", () => {
  beforeEach(() => fakeApi.reset());

  it("shows each warband's rule pills, and a pill opens its rule to read", async () => {
    fakeApi.on("GET /warbands/1/rules/", [{ id: 5, title: "Hard Head", description: "Maces." }]);
    fakeApi.on("GET /warbands/2/rules/", []);
    renderWithQueryClient(
      <BattleWarbandRules
        campaignId={3}
        warbands={[
          { id: 1, name: "Grudgebearers" },
          { id: 2, name: "Rats" },
        ]}
      />
    );
    const user = setupUser();
    expect(await screen.findByText("Grudgebearers")).toBeInTheDocument();
    expect(screen.queryByText("Rats")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hard Head" }));
    const dialog = await screen.findByRole("dialog", { name: "Warband rules" });
    expect(within(dialog).getByRole("article", { name: "Hard Head" })).toHaveTextContent("Maces.");
    expect(within(dialog).queryByRole("button", { name: "Add rule" })).toBeNull();
  });
});
