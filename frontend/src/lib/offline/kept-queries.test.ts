import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createQueryClient } from "@/lib/query-client";
import { isKeptQueryKey, KEPT_MAX_AGE_MS, shouldKeepQuery } from "./kept-queries";

const c = queryKeys.campaign;

describe("the reads kept on the phone", () => {
  it.each([
    ["your campaigns", queryKeys.campaigns()],
    ["the settings", queryKeys.settings()],
    ["the campaign", c.detail(1)],
    ["its players", c.players(1)],
    ["its rules", c.campaignRules(1)],
    ["its charts", c.campaignCharts(1)],
    ["its house rules", c.houseRules(1)],
    ["the post-game rules", c.battleRules(1)],
    ["its scenarios", c.scenarios(1)],
    ["a scenario", c.scenarioEntry(1, 4)],
    ["its locations", c.locations(1)],
    ["its encampments", c.encampments(1)],
    ["its exploration chart", c.explorationChart(1)],
    ["its warband lists", c.warbandTemplates(1)],
    ["a warband list", c.warbandTemplate(1, 7)],
    ["a catalogue list", c.catalogue(1, "items")],
    ["a hired sword", c.catalogueEntry(1, "hired-swords", 5)],
    ["the open battles", c.openBattles(1)],
    ["your warband", c.myWarband(1)],
    ["a warband sheet", c.warbandSheet(1, 9)],
    ["its rules", c.warbandRules(1, 9)],
    ["its stash", c.warbandStash(1, 9)],
    ["what it can buy", c.warbandWhoCan(1, 9)],
    ["a battle's state", c.battleState(1, 3)],
    ["a battle's rosters", c.battleRosters(1, 3)],
  ])("keeps %s", (_name, key) => {
    expect(isKeptQueryKey(key)).toBe(true);
  });

  it.each([
    ["the members, with their emails", c.members(1)],
    ["the chat", c.chat(1)],
    ["a trade", c.trade(1, "abc")],
    ["your open trades", c.openTrades(1)],
    ["the bounties", c.bounties(1)],
    ["the bounty targets", c.bountyTargets(1)],
    ["the leave preview", c.leavePreview(1)],
    ["a member's removal", c.memberRemoval(1, 2)],
    ["the account deletion preview", queryKeys.account.deletionPreview()],
    ["a share code", queryKeys.sharedCode("ABCD1234")],
    ["an archived list", c.catalogueVariant(1, "items", "archived")],
    ["what holds an entry", c.catalogueUsage(1, "items", 3)],
    ["the warband lists' contents", c.warbandTemplateContents(1)],
    ["the ledger", c.warbandTreasury(1, 9)],
    ["the logs", c.warbandLogs(1, 9)],
    ["the battle history", c.battleHistory(1)],
    ["a finished battle's record", c.battleRecord(1, 3)],
    ["the chronicle", c.chronicle(1, "kills")],
    ["a search", ["campaign", 1, "search", "sword"]],
    ["the summary read", c.warbandSummary(1, 9)],
  ])("leaves out %s", (_name, key) => {
    expect(isKeptQueryKey(key)).toBe(false);
  });
});

function seeded(key: readonly unknown[], data: unknown, updatedAt = Date.now()) {
  const client = new QueryClient();
  client.setQueryData(key, data, { updatedAt });
  const cache = client.getQueryCache();
  return { client, cache, query: cache.find({ queryKey: key, exact: true })! };
}

describe("what is written now", () => {
  it("writes a kept read that loaded", () => {
    const { cache, query } = seeded(c.warbandSheet(1, 9), { id: 9 });
    expect(shouldKeepQuery(query, cache)).toBe(true);
  });

  it("drops one older than a week", () => {
    const { cache, query } = seeded(c.warbandSheet(1, 9), { id: 9 }, 0);
    expect(shouldKeepQuery(query, cache, KEPT_MAX_AGE_MS + 1)).toBe(false);
  });

  it("drops a read that never loaded", () => {
    const client = new QueryClient();
    const cache = client.getQueryCache();
    const queryKey: QueryKey = c.warbandSheet(1, 9);
    const query = cache.build(client, { queryKey });
    expect(shouldKeepQuery(query, cache)).toBe(false);
  });

  it("drops a battle that is over, its rosters too, and keeps one in progress", () => {
    const state = (status: string) => ({ battle: { status }, participants: [], events: [] });
    const { client, cache, query } = seeded(c.battleState(1, 3), state("active"));
    client.setQueryData(c.battleRosters(1, 3), {});
    const rosters = cache.find({ queryKey: c.battleRosters(1, 3), exact: true })!;
    expect(shouldKeepQuery(query, cache)).toBe(true);
    expect(shouldKeepQuery(rosters, cache)).toBe(true);

    client.setQueryData(c.battleState(1, 3), state("ended"));
    expect(shouldKeepQuery(query, cache)).toBe(false);
    expect(shouldKeepQuery(rosters, cache)).toBe(false);
  });
});

describe("in memory", () => {
  it("keeps a kept read for a week once nothing shows it, even a battle's (gcTime 0), and others as before", () => {
    const client = createQueryClient();
    const cache = client.getQueryCache();
    const battle = cache.build(client, { queryKey: c.battleState(1, 3), gcTime: 0 });
    const members = cache.build(client, { queryKey: c.members(1) });
    expect(battle.gcTime).toBe(KEPT_MAX_AGE_MS);
    expect(members.gcTime).toBe(5 * 60_000);
    client.clear();
  });
});
