import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "@/test/query-test-utils";
import {
  invalidateHeldCopies,
  removeCatalogueEntry,
  upsertCatalogueEntry,
} from "./catalogue-queries";
import { queryKeys } from "./query-keys";

import type { Skill } from "@/features/skills/types/skill-types";

const skill = (id: number, name: string) => ({ id, name, type: "Speed" }) as Skill;
const skillsKey = queryKeys.campaign.catalogue(7, "skills");

describe("catalogue cache writes", () => {
  it("replaces an entry by id and puts new entries first", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(skillsKey, [skill(10, "Sprint")]);

    upsertCatalogueEntry(queryClient, "skills", 7, skill(10, "Sprint II"));
    upsertCatalogueEntry(queryClient, "skills", 7, skill(11, "Step Aside"));

    expect(queryClient.getQueryData(skillsKey)).toEqual([
      skill(11, "Step Aside"),
      skill(10, "Sprint II"),
    ]);
  });

  it("puts a version in its book entry's place, and the book entry back in the version's (CAT-TWEAK-01)", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(skillsKey, [skill(10, "Sprint"), skill(11, "Step Aside")]);

    upsertCatalogueEntry(queryClient, "skills", 7, skill(40, "Sprint (ours)"), 10);
    expect(queryClient.getQueryData(skillsKey)).toEqual([
      skill(40, "Sprint (ours)"),
      skill(11, "Step Aside"),
    ]);

    upsertCatalogueEntry(queryClient, "skills", 7, skill(10, "Sprint"), 40);
    expect(queryClient.getQueryData(skillsKey)).toEqual([
      skill(10, "Sprint"),
      skill(11, "Step Aside"),
    ]);
  });

  it("writes every cached list of the kind, and leaves a cached single entry alone", () => {
    const queryClient = createTestQueryClient();
    const archivedKey = [...skillsKey, "archived"];
    const entryKey = [...skillsKey, 10];
    queryClient.setQueryData(skillsKey, [skill(10, "Sprint")]);
    queryClient.setQueryData(archivedKey, [skill(12, "Old Trick"), skill(10, "Sprint")]);
    queryClient.setQueryData(entryKey, skill(10, "Sprint"));

    upsertCatalogueEntry(queryClient, "skills", 7, skill(10, "Sprint II"));

    expect(queryClient.getQueryData(archivedKey)).toEqual([
      skill(12, "Old Trick"),
      skill(10, "Sprint II"),
    ]);
    expect(queryClient.getQueryData(entryKey)).toEqual(skill(10, "Sprint"));
    expect(queryClient.getQueryState(entryKey)?.isInvalidated).toBe(true);
  });

  it("marks the campaign's warband sheets and stashes stale after an item change, and nothing else", () => {
    const queryClient = createTestQueryClient();
    const keys = {
      sheet: queryKeys.campaign.warbandSheet(7, 101),
      otherSheet: queryKeys.campaign.warbandSheet(7, 102),
      stash: queryKeys.campaign.warbandStash(7, 101),
      treasury: queryKeys.campaign.warbandTreasury(7, 101),
      mine: queryKeys.campaign.myWarband(7),
      elsewhere: queryKeys.campaign.warbandSheet(8, 201),
    };
    Object.values(keys).forEach((key) => queryClient.setQueryData(key, {}));
    const stale = () =>
      Object.fromEntries(
        Object.entries(keys).map(([name, key]) => [
          name,
          queryClient.getQueryState(key)?.isInvalidated,
        ])
      );

    void invalidateHeldCopies(queryClient, "items", 7);

    expect(stale()).toEqual({
      sheet: true,
      otherSheet: true,
      stash: true,
      treasury: false,
      mine: false,
      elsewhere: false,
    });
  });

  it("marks only the sheets stale after a skill change (stashes hold items), and nothing for a kind units don't hold", () => {
    const queryClient = createTestQueryClient();
    const sheet = queryKeys.campaign.warbandSheet(7, 101);
    const stash = queryKeys.campaign.warbandStash(7, 101);
    queryClient.setQueryData(sheet, {});
    queryClient.setQueryData(stash, []);

    void invalidateHeldCopies(queryClient, "bestiary", 7);
    expect(queryClient.getQueryState(sheet)?.isInvalidated).toBe(false);

    void invalidateHeldCopies(queryClient, "skills", 7);
    expect(queryClient.getQueryState(sheet)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(stash)?.isInvalidated).toBe(false);
  });

  it("removes an entry by id", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(skillsKey, [skill(10, "Sprint"), skill(11, "Step Aside")]);

    removeCatalogueEntry(queryClient, "skills", 7, 10);

    expect(queryClient.getQueryData(skillsKey)).toEqual([skill(11, "Step Aside")]);
  });

  it("marks the list stale so the next reader refetches it", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(skillsKey, [skill(10, "Sprint")]);

    upsertCatalogueEntry(queryClient, "skills", 7, skill(11, "Step Aside"));

    expect(queryClient.getQueryState(skillsKey)?.isInvalidated).toBe(true);
  });

  it("leaves a list that was never loaded for its first fetch", () => {
    const queryClient = createTestQueryClient();

    upsertCatalogueEntry(queryClient, "skills", 7, skill(11, "Step Aside"));

    expect(queryClient.getQueryData(skillsKey)).toBeUndefined();
  });
});
