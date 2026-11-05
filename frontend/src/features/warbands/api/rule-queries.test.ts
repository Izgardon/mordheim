import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper, createTestQueryClient } from "@/test/query-test-utils";

import { useRuleCreate, useRuleDelete, useRuleUpdate, useRulesFromTemplate } from "./rule-queries";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const rule = { id: 3, title: "Mutations", description: "" };

/** The warband's template, read once (its `missing_rules`), and whether a rule write marks it stale. */
function setUp() {
  const queryClient = createTestQueryClient();
  const key = queryKeys.campaign.warbandHireTemplate(7, 9);
  queryClient.setQueryData(key, { template: { missing_rules: 0 } });
  const stale = () => queryClient.getQueryState(key)?.isInvalidated;
  return { wrapper: createQueryWrapper(queryClient), stale };
}

describe("a warband rule's write", () => {
  beforeEach(() => fakeApi.reset());

  it("reads the warband's template again: a delete, an edit, an add and Add the template's rules", async () => {
    fakeApi.on("DELETE /warbands/9/rules/3/", null);
    fakeApi.on("PATCH /warbands/9/rules/3/", rule);
    fakeApi.on("POST /warbands/9/rules/", rule);
    fakeApi.on("POST /warbands/9/rules/from-template/", [rule]);
    const writes = [
      (hooks: Hooks) => hooks.remove.mutateAsync(3),
      (hooks: Hooks) =>
        hooks.update.mutateAsync({ ruleId: 3, title: "Mutations", description: "" }),
      (hooks: Hooks) => hooks.create.mutateAsync({ title: "Mutations", description: "" }),
      (hooks: Hooks) => hooks.fromTemplate.mutateAsync(),
    ];
    for (const write of writes) {
      const { wrapper, stale } = setUp();
      const { result } = renderHook(() => useHooks(), { wrapper });
      expect(stale()).toBe(false);
      await act(async () => {
        await write(result.current);
      });
      expect(stale()).toBe(true);
    }
  });
});

const useHooks = () => ({
  create: useRuleCreate(9),
  update: useRuleUpdate(9),
  remove: useRuleDelete(9),
  fromTemplate: useRulesFromTemplate(9),
});
type Hooks = ReturnType<typeof useHooks>;
