import type { Bounty, BountyClaim, BountyList } from "./types";

/** Who is reading: his user and his warband in the campaign (null without one). */
export type BountyReader = { userId: number | null; warbandId: number | null };

export const isLive = (bounty: Bounty) => bounty.status === "open" || bounty.status === "claimed";

/**
 * What the reader may do with a bounty, as the server allows it: only its poster withdraws it;
 * anyone else with a warband, but the target's owner, claims it once at a time; each side
 * answers its own part of a claim (the poster accepts or declines, the claimant takes his back).
 */
export function bountyRoles(bounty: Bounty, reader: BountyReader) {
  const live = isLive(bounty);
  const poster = reader.userId !== null && bounty.posted_by.user_id === reader.userId;
  const onMine = reader.warbandId !== null && bounty.target.warband_id === reader.warbandId;
  const waiting = bounty.claims.filter((claim) => claim.status === "pending");
  const myClaim = waiting.find((claim) => claim.user_id === reader.userId) ?? null;
  const ownBounty = reader.warbandId !== null && bounty.posted_by.warband_id === reader.warbandId;
  return {
    poster,
    onMine,
    waiting,
    myClaim,
    canWithdraw: live && poster,
    canClaim: live && reader.warbandId !== null && !poster && !ownBounty && !onMine && !myClaim,
    /** The claims waiting for the reader's answer (he posted the bounty). */
    toAnswer: live && poster ? waiting : [],
  };
}

export const goldText = (amount: number) => `${amount} gc`;

/** Why the hero is off his roster, and that the bounty stands all the same; null while he is on it. */
export function goneText(bounty: Bounty) {
  const { name, gone } = bounty.target;
  if (gone === "dead")
    return `${name} is dead. The bounty stays open until it's claimed or withdrawn.`;
  if (gone === "dismissed")
    return `${name} has left the warband. The bounty stays open all the same.`;
  if (gone === "removed")
    return `${name} is no longer on any roster. The bounty stays open all the same.`;
  return null;
}

/** "Ada claims it for Kreech · Street Fight" ("You claim it ..." for the reader's own). */
export function claimLine(claim: BountyClaim, readerId: number | null = null) {
  const where = claim.battle ? ` · ${claim.battle.scenario}` : "";
  const who = claim.user_id === readerId ? "You claim" : `${claim.user_name} claims`;
  return `${who} it for ${claim.unit_name}${where}`;
}

/** The live bounties on one hero, and their total. */
export function bountiesOn(list: BountyList | undefined, heroId: number) {
  const bounties = (list?.bounties ?? []).filter(
    (bounty) => isLive(bounty) && bounty.target.hero_id === heroId
  );
  return { bounties, total: bounties.reduce((sum, bounty) => sum + bounty.amount, 0) };
}

/**
 * What the reader's warband would owe if every bounty it has open were paid, with `adding` more:
 * the dialog's "can't afford it right now" warning (the server warns the same when posting).
 */
export function owedWith(list: BountyList | undefined, adding: number) {
  const mine = list?.my_warband;
  if (!mine) return null;
  const open = (list?.bounties ?? []).filter(
    (bounty) => isLive(bounty) && bounty.posted_by.warband_id === mine.id
  );
  const owed = open.reduce((sum, bounty) => sum + bounty.amount, 0) + adding;
  return { owed, gold: mine.gold, short: owed > mine.gold, warbandName: mine.name };
}
