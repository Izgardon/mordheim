import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "@/test/query-test-utils";
import { removeCatalogueEntry, upsertCatalogueEntry } from "./catalogue-queries";
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
