import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import PriceRowsField from "./PriceRowsField";
import { priceRowsOf, priceRowsPayload, type PriceRowDraft } from "../utils/price-rows";
import type { ItemAvailability } from "../types/item-types";

vi.mock("@/features/warbands/api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: [] }),
}));
vi.mock("@/features/items/api/who-can-queries", () => ({ useWarbandGroups: () => ({ data: [] }) }));

const held = (changes: Partial<ItemAvailability> = {}): ItemAvailability => ({
  id: 1,
  label: "",
  cost: 25,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity: null,
  for_everyone: true,
  warbands: [],
  note: "",
  ...changes,
});

let latest: PriceRowDraft[] = [];

function Rows({ start }: { start: PriceRowDraft[] }) {
  const [rows, setRows] = useState(start);
  latest = rows;
  return (
    <PriceRowsField
      campaignId={1}
      rows={rows}
      onChange={setRows}
      errorOf={() => undefined}
      path="availabilities"
      idPrefix="price"
    />
  );
}

describe("PriceRowsField", () => {
  it("offers a new row only the note when buying, and its dice as a count of D6", async () => {
    const userEvent = setupUser();
    render(<Rows start={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a price" }));

    expect(screen.getByLabelText("Note when buying")).toBeInTheDocument();
    expect(screen.queryByLabelText("Label")).toBeNull();
    expect(screen.queryByLabelText("Cost note")).toBeNull();

    await userEvent.type(screen.getByLabelText("Cost (gc)"), "25");
    await userEvent.type(screen.getByLabelText("Dice for price 1: how many D6"), "2");
    await userEvent.click(
      screen.getByRole("button", { name: "Dice for price 1: multiply each pip" })
    );
    await userEvent.type(screen.getByLabelText("Dice for price 1: each pip is worth"), "10");
    expect(priceRowsPayload(latest)[0]).toMatchObject({ cost: 25, dice: 2, dice_multiplier: 10 });
  });

  it("keeps showing a label and a cost note a row already holds, and saves them as they were", () => {
    const rows = priceRowsOf([
      held({ label: "Brace", cost_note: "per pair", dice: 1, dice_multiplier: 25 }),
      held({ id: 2, note: "Heroes only" }),
    ]);
    render(<Rows start={rows} />);

    expect(screen.getAllByLabelText("Label")).toHaveLength(1);
    expect(screen.getByLabelText("Label")).toHaveValue("Brace");
    expect(screen.getByLabelText("Cost note")).toHaveValue("per pair");
    const dice = screen.getByRole("group", { name: "Dice for price 1" });
    expect(within(dice).getByLabelText("Dice for price 1: each pip is worth")).toHaveValue("25");
    expect(priceRowsPayload(latest)).toMatchObject([
      { label: "Brace", cost_note: "per pair", dice: 1, dice_multiplier: 25 },
      { label: "", cost_note: "", note: "Heroes only" },
    ]);
  });
});
