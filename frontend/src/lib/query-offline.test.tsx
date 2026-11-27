/**
 * The list hooks beside useCatalogue (catalogue-queries.offline.test.tsx) read a paused query with
 * nothing to show as loading, never as an empty answer: who-can (an empty one dims everything in
 * the store) and the warband lists.
 */
import { onlineManager } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWhoCan } from "@/features/items/api/who-can-queries";
import {
  useWarbandTemplateContents,
  useWarbandTemplates,
} from "@/features/warband-templates/api/template-queries";
import { createQueryWrapper } from "@/test/query-test-utils";

import { NO_CONNECTION_LIST } from "./query-offline";

beforeEach(() => onlineManager.setOnline(false));
afterEach(() => onlineManager.setOnline(true));

const render = <T,>(hook: () => T) => renderHook(hook, { wrapper: createQueryWrapper() }).result;

describe("list hooks offline", () => {
  it("who-can is loading, not empty", () => {
    expect(render(() => useWhoCan(7, 9)).current.isLoading).toBe(true);
  });

  it("the warband lists are loading and say there is no connection", () => {
    expect(render(() => useWarbandTemplates(7)).current).toMatchObject({
      isLoading: true,
      error: NO_CONNECTION_LIST,
    });
    expect(render(() => useWarbandTemplateContents(7)).current.isLoading).toBe(true);
  });
});
