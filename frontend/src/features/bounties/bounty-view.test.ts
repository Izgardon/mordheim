import { describe, expect, it } from "vitest";

import { bountiesOn, bountyRoles, claimLine, goneText, owedWith } from "./bounty-view";
import type { Bounty, BountyClaim, BountyList } from "./types";

const claim = (overrides: Partial<BountyClaim> = {}): BountyClaim => ({
  id: 7,
  status: "pending",
  warband_id: 30,
  warband_name: "Crows",
  user_id: 3,
  user_name: "Ada",
  unit_name: "Kreech",
  unit: { kind: "hero", id: 9, name: "Kreech" },
  kill_id: null,
  battle: null,
  poster_accepted: false,
  claimant_accepted: true,
  created_at: "2026-11-01T10:00:00Z",
  answered_at: null,
  ...overrides,
});

const bounty = (overrides: Partial<Bounty> = {}): Bounty => ({
  id: 1,
  campaign_id: 5,
  status: "open",
  amount: 40,
  note: "",
  target: {
    hero_id: 12,
    name: "Grey Seer",
    is_leader: true,
    gone: null,
    warband_id: 20,
    warband_name: "Rats",
    user_id: 2,
  },
  posted_by: { warband_id: 10, warband_name: "Monks", user_id: 1, user_name: "Pia" },
  paid_claim_id: null,
  created_at: "2026-11-01T09:00:00Z",
  closed_at: null,
  claims: [],
  ...overrides,
});

describe("bountyRoles", () => {
  it("lets only the poster withdraw, and answer the claims waiting", () => {
    const waiting = claim();
    const roles = bountyRoles(bounty({ status: "claimed", claims: [waiting] }), {
      userId: 1,
      warbandId: 10,
    });
    expect(roles).toMatchObject({ poster: true, canWithdraw: true, canClaim: false });
    expect(roles.toAnswer).toEqual([waiting]);
  });

  it("lets anyone else with a warband claim, but the target's owner and a claimant waiting", () => {
    const open = bounty();
    expect(bountyRoles(open, { userId: 3, warbandId: 30 }).canClaim).toBe(true);
    expect(bountyRoles(open, { userId: 2, warbandId: 20 })).toMatchObject({
      canClaim: false,
      onMine: true,
    });
    expect(bountyRoles(open, { userId: 4, warbandId: null }).canClaim).toBe(false);
    const claimed = bounty({ status: "claimed", claims: [claim()] });
    const ada = bountyRoles(claimed, { userId: 3, warbandId: 30 });
    expect(ada.canClaim).toBe(false);
    expect(ada.myClaim?.id).toBe(7);
    expect(ada.toAnswer).toEqual([]);
  });

  it("allows nothing on a paid or withdrawn bounty", () => {
    for (const status of ["paid", "withdrawn"] as const) {
      const roles = bountyRoles(bounty({ status }), { userId: 1, warbandId: 10 });
      expect(roles.canWithdraw).toBe(false);
      expect(bountyRoles(bounty({ status }), { userId: 3, warbandId: 30 }).canClaim).toBe(false);
    }
  });
});

describe("the words", () => {
  it("says the bounty stands when the hero is dead or gone", () => {
    expect(goneText(bounty())).toBeNull();
    const dead = bounty({ target: { ...bounty().target, gone: "dead" } });
    expect(goneText(dead)).toBe(
      "Grey Seer is dead. The bounty stays open until it's claimed or withdrawn."
    );
  });

  it("names the claimant, his unit and the battle", () => {
    expect(claimLine(claim())).toBe("Ada claims it for Kreech");
    const inBattle = claim({ battle: { id: 4, scenario: "Street Fight", date: "01/11/26" } });
    expect(claimLine(inBattle)).toBe("Ada claims it for Kreech · Street Fight");
    expect(claimLine(inBattle, 3)).toBe("You claim it for Kreech · Street Fight");
  });
});

describe("totals", () => {
  const list: BountyList = {
    bounties: [
      bounty(),
      bounty({ id: 2, amount: 15 }),
      bounty({ id: 3, target: { ...bounty().target, hero_id: 99 } }),
    ],
    my_warband: { id: 10, name: "Monks", gold: 90 },
  };

  it("adds up the live bounties on a hero", () => {
    expect(bountiesOn(list, 12).total).toBe(55);
    expect(bountiesOn(list, 1).bounties).toEqual([]);
  });

  it("warns when the reader's open bounties would come to more than he holds", () => {
    expect(owedWith(list, 0)).toMatchObject({ owed: 95, gold: 90, short: true });
    expect(owedWith({ ...list, my_warband: null }, 10)).toBeNull();
  });
});
