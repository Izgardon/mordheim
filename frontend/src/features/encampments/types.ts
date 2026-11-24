import type { CampaignRule } from "@/features/rules/types/rule-types";

/** The warband holding an encampment, with its player's name. */
export type EncampmentHolder = { id: number; name: string; player: string };

/**
 * A place a warband holds (William, 24 Nov 2026): how it is gained, whether it is fortified, what
 * holding it gives, who holds it (null: nobody) and whether it is razed. `capabilities` are the
 * server's: what you may do with it.
 */
export type CampaignEncampment = {
  id: number;
  group_id: number;
  name: string;
  gained_by: string;
  fortified: boolean;
  text: string;
  holder: EncampmentHolder | null;
  razed: boolean;
  order: number;
  capabilities: { take: boolean; raze: boolean; give_up: boolean };
};

/** A group of encampments (Marienburg city, Outside the city). */
export type EncampmentGroup = {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  order: number;
  encampments: CampaignEncampment[];
};

/** A warband you may take an encampment for: yours, or any for one who manages encampments. */
export type EncampmentTaker = { id: number; name: string; mine: boolean };

/** The Encampments page's read: the holding rules, the groups, and whom you may take one for. */
export type EncampmentsPage = {
  rules: CampaignRule[];
  groups: EncampmentGroup[];
  takers: EncampmentTaker[];
};

export type EncampmentGroupPayload = Pick<EncampmentGroup, "name" | "description">;

export type EncampmentPayload = Pick<
  CampaignEncampment,
  "group_id" | "name" | "gained_by" | "fortified" | "text"
>;

export type EncampmentWarning = { code: string; message: string };

/** What a take, raze or give up answers: the encampment as it now stands, and the warnings. */
export type HoldingAnswer = { encampment: CampaignEncampment; warnings: EncampmentWarning[] };

export type HoldingAction = "take" | "raze" | "give-up";
