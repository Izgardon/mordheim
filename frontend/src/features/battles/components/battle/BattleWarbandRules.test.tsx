/**
 * The battle Rules sheet's Warband rules (William, 24 Nov 2026): a row per warband in the battle,
 * grouped as its rules modal groups them, opening in place to its rules, never a modal on top of
 * the sheet (William, 12 Nov 2026); a warband with none is left out.
 */
import { useState } from "react";
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

function Harness() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <BattleWarbandRules
      campaignId={3}
      warbands={[
        { id: 1, name: "Grudgebearers" },
        { id: 2, name: "Rats" },
      ]}
      openKey={openKey}
      onToggle={(key) => setOpenKey(openKey === key ? null : key)}
    />
  );
}

describe("BattleWarbandRules", () => {
  beforeEach(() => fakeApi.reset());

  it("opens a warband's row in place to every rule of it", async () => {
    fakeApi.on("GET /warbands/1/rules/", [
      { id: 5, title: "Hard Head", description: "Maces." },
      { id: 6, title: "Stubborn", description: "No rout." },
    ]);
    fakeApi.on("GET /warbands/2/rules/", []);
    renderWithQueryClient(<Harness />);
    const user = setupUser();

    const row = await screen.findByRole("button", { name: /Grudgebearers/ });
    expect(row).toHaveTextContent("2 rules");
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Rats/ })).toBeNull();

    await user.click(row);
    expect(screen.getByRole("article", { name: "Hard Head" })).toHaveTextContent("Maces.");
    expect(screen.getByRole("article", { name: "Stubborn" })).toHaveTextContent("No rout.");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(row);
    expect(screen.queryByRole("article", { name: "Hard Head" })).toBeNull();
  });

  it("says so while nobody has a rule", async () => {
    fakeApi.on("GET /warbands/1/rules/", []);
    fakeApi.on("GET /warbands/2/rules/", []);
    renderWithQueryClient(<Harness />);

    expect(await screen.findByText("No warband rules.")).toBeInTheDocument();
  });
});
