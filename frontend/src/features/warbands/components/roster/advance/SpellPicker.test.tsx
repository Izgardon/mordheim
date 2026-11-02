/**
 * A lore's table has one spell on each roll; a spell with none shows "–" and is still picked by a
 * click, but a die never lands on it.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Spell } from "@/features/spells/types/spell-types";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import SpellPicker from "./SpellPicker";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const LORE = "Necromancy (Restless Dead)";
const visage: Spell = { id: 61, name: "Deathly Visage", type: LORE, dc: "6", roll: 6 };
const horror: Spell = { id: 62, name: "Living Horror", type: LORE, dc: "8", roll: null };
const awakening: Spell = { id: 63, name: "Spell of Awakening", type: LORE, dc: "Auto", roll: 1 };

describe("The spell picker", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /spells/?campaign_id=1", [visage, horror, awakening]);
  });

  it("shows a spell with no roll as – and picks it by a click; a roll lands only on its own row", async () => {
    const onChange = vi.fn();
    renderWithQueryClient(
      <SpellPicker campaignId={1} known={[awakening]} value={null} onChange={onChange} />
    );
    const user = setupUser();
    const table = await screen.findByRole("table", { name: `${LORE} spells` });
    const rows = await within(table).findAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "1Spell of AwakeningAuto",
      "6Deathly Visage6",
      "–Living Horror8",
    ]);

    await user.click(within(table).getByRole("button", { name: "Living Horror" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "pick", spell: horror, known: false })
    );
    await user.type(screen.getByLabelText("D6 rolled"), "6");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "roll", roll: 6, spell: visage })
    );
  });
});
