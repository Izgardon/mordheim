/**
 * What an edited entry's kit lines keep through the form (weapon materials): the form never sets
 * what the book makes a line of, nor the name its kit gives the item, so it reads both with the
 * entry and sends them back. Before this a save of the Runesmith Journeyman dropped them and his
 * gromril hammer became a plain one.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReactNode } from "react";

import { createTestQueryClient } from "@/test/query-test-utils";
import { makeItem } from "@/test/warband-fixtures";

import { useBestiaryLinks, type LinkedEntry } from "./useBestiaryLinks";

const dagger = makeItem({ id: 11, name: "Dagger", type: "Weapon" });
const armour = makeItem({ id: 12, name: "Heavy Armour", type: "Armour" });
const entry: LinkedEntry = {
  skills: [],
  specials: [],
  spells: [],
  equipment: [
    { item: dagger, quantity: 1, material: "gromril", shown_as: "Jambiya" },
    { item: armour, quantity: 1 },
  ],
};

const links = () => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () =>
      useBestiaryLinks({ campaignId: 7, open: true, specialType: "Hired Sword", maxQuantity: 20 }),
    { wrapper }
  );
  return result;
};

describe("useBestiaryLinks kit lines", () => {
  it("sends back what the entry's kit lines were made of and called", () => {
    const result = links();

    act(() => result.current.load(entry));

    expect(result.current.payload().item_entries).toEqual([
      { item_id: 11, quantity: 1, material: "gromril", shown_as: "Jambiya" },
      { item_id: 12, quantity: 1 },
    ]);
  });

  it("says nothing of either for a line added in the form", () => {
    const result = links();

    act(() => result.current.addItem(dagger));

    expect(result.current.payload().item_entries).toEqual([{ item_id: 11, quantity: 1 }]);
  });
});
