/**
 * A beast's Animal item is written with it (the bestiary rewrite, step 3): every bestiary write
 * the writer caches (a save, a Revert, a delete, a restore) marks the items lists stale too, and a
 * beast's first edit or Revert, which move the copies of its item, marks the warband sheets and
 * stashes stale, as an item's would. Other kinds change their own lists only.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { createTestQueryClient } from "@/test/query-test-utils";
import { useCatalogueCache } from "./catalogue-queries";
import { queryKeys } from "./query-keys";

import type { ReactNode } from "react";

const items = queryKeys.campaign.catalogue(7, "items");
const archivedItems = queryKeys.campaign.catalogueVariant(7, "items", "archived");
const bestiary = queryKeys.campaign.catalogue(7, "bestiary");
const sheet = queryKeys.campaign.warbandSheet(7, 101);
const stash = queryKeys.campaign.warbandStash(7, 101);

function setup() {
  const queryClient = createTestQueryClient();
  [items, archivedItems, bestiary, sheet, stash].forEach((key) =>
    queryClient.setQueryData(key, [])
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCatalogueCache(), { wrapper });
  return { queryClient, cache: result.current };
}

const stale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

describe("a beast's writes change the items list too", () => {
  it("marks every items list stale when a beast is saved, removed or invalidated", () => {
    for (const write of ["write", "remove", "invalidate"] as const) {
      const { queryClient, cache } = setup();
      if (write === "write") cache.write("bestiary", 7, bestiaryEntry(), 5);
      if (write === "remove") cache.remove("bestiary", 7, 5);
      if (write === "invalidate") void cache.invalidate("bestiary", 7);

      expect(stale(queryClient, items)).toBe(true);
      expect(stale(queryClient, archivedItems)).toBe(true);
    }
  });

  it("marks the warband sheets and stashes stale when the copies of a beast's item move", () => {
    const { queryClient, cache } = setup();

    void cache.heldCopiesChanged("bestiary", 7);

    expect(stale(queryClient, sheet)).toBe(true);
    expect(stale(queryClient, stash)).toBe(true);
  });

  it("marks the hired-sword and dramatis-persona lists stale when a race is written: they name their race", () => {
    const { queryClient, cache } = setup();
    const hiredSwords = queryKeys.campaign.catalogue(7, "hired-swords");
    const personae = queryKeys.campaign.catalogue(7, "dramatis-personae");
    queryClient.setQueryData(hiredSwords, []);
    queryClient.setQueryData(personae, []);

    cache.upsert("races", 7, { id: 3, name: "Halfling" } as never);

    expect(stale(queryClient, hiredSwords)).toBe(true);
    expect(stale(queryClient, personae)).toBe(true);
    expect(stale(queryClient, items)).toBe(false);
  });

  it("leaves the items list alone when a skill is saved", () => {
    const { queryClient, cache } = setup();

    cache.write("skills", 7, { id: 1, name: "Sprint", type: "Speed", description: "" });

    expect(stale(queryClient, items)).toBe(false);
  });
});
