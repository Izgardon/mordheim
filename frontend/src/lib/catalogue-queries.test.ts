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
