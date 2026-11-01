/** Bounties (William, 2026-10-25 and 2026-10-28): gold on an enemy hero, paid when a claim is accepted. */

export type BountyStatus = "open" | "claimed" | "paid" | "withdrawn";
export type BountyClaimStatus = "pending" | "paid" | "declined" | "withdrawn" | "closed";
/** A unit as its warband page's card names it (`?unit=<kind>-<id>`). */
export type BountyUnitCard = {
  kind: "hero" | "henchmen_group" | "hireling";
  id: number;
  name: string;
};

export type BountyClaim = {
  id: number;
  status: BountyClaimStatus;
  warband_id: number;
  warband_name: string;
  user_id: number;
  user_name: string;
  unit_name: string;
  /** The unit's card, null once its row is gone. */
  unit: BountyUnitCard | null;
  kill_id: number | null;
  battle: { id: number; scenario: string; date: string } | null;
  poster_accepted: boolean;
  claimant_accepted: boolean;
  created_at: string;
  answered_at: string | null;
};

export type Bounty = {
  id: number;
  campaign_id: number;
  status: BountyStatus;
  amount: number;
  note: string;
  target: {
    hero_id: number | null;
    name: string;
    is_leader: boolean;
    /** Why the hero is off his roster; the bounty stays open all the same. */
    gone: "dead" | "dismissed" | "removed" | null;
    warband_id: number | null;
    warband_name: string;
    user_id: number | null;
  };
  posted_by: { warband_id: number; warband_name: string; user_id: number; user_name: string };
  paid_claim_id: number | null;
  created_at: string;
  closed_at: string | null;
  claims: BountyClaim[];
};

/** What a write went ahead despite (a guide, not a gatekeeper): only the acting player's answer. */
export type BountyWarning = { code: string; message: string };
export type BountyAnswer = Bounty & { warnings?: BountyWarning[] };

/** `GET bounties/`: the open bounties, and the reader's own warband (null without one). */
export type BountyList = {
  bounties: Bounty[];
  my_warband: { id: number; name: string; gold: number } | null;
};

export type BountyTargetWarband = {
  warband_id: number;
  warband_name: string;
  user_name: string;
  heroes: { id: number; name: string; unit_type: string; is_leader: boolean }[];
};

export type BountyCandidate = {
  kind: "kill" | "out_of_action";
  kill_id: number | null;
  battle: { id: number; scenario: string; date: string };
  round: number | null;
  how: string | null;
  unit: { kind: "hero" | "henchman" | "hireling"; id: number; name: string } | null;
  text: string;
};

/** `GET bounties/<id>/candidates/`: what the reader can put to a claim. */
export type BountyCandidates = {
  candidates: BountyCandidate[];
  units: {
    kind: "hero" | "henchmen_group" | "hireling";
    id: number;
    name: string;
    dead: boolean;
  }[];
  battles: { id: number; scenario: string; date: string }[];
};

export type PostBountyPayload = { hero_id: number; amount: number; note: string };
export type ClaimBountyPayload = {
  unit?: { kind: "hero" | "henchmen_group" | "hireling"; id: number };
  kill_id?: number;
  battle_id?: number;
};

/** A claim on your bounty, in the bell until you answer it (`bounty_claim`). */
export type BountyClaimNotification = {
  id: string;
  notificationDbId: number;
  campaignId: number;
  bountyId: number;
  claimId: number;
  amount: number;
  targetName: string;
  claimantUserName: string;
  claimantWarbandName: string;
  unitName: string;
  battleScenario: string | null;
  createdAt: string;
};
