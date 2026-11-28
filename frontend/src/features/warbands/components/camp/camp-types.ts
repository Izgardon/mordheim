import type { PostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type {
  BattleParticipant,
  BattlePostbattleState,
  BattleState,
} from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import type { HenchmenGroup, WarbandHireling, WarbandResource } from "../../types/warband-types";

/** Camp's rows (design E), top to bottom; Ready sits under them. Pacts shows only while the
 * campaign has blood pacts on, and sits after Upkeep, as the book rolls for a pact after it. */
export type CampRow = "sell" | "recruit" | "hire" | "upkeep" | "pacts" | "buy";

/** Whose post-game to find: your own warband's, in the campaign (the bar and camp both read it). */
export type PostgameSource = {
  campaignId: number;
  campaign: CampaignSummary | null;
  warbandId: number;
  userId: number | undefined;
  /** Your own warband: someone else's shows no post-game. */
  enabled: boolean;
};

/** Camp beside the roster on the web, or the phone's post-game card. */
export type PostgameSlotProps = PostgameSource & {
  isMobile: boolean;
  /** Hire (the Hired swords row). */
  onHire: () => void;
  /** Buy items: opens the store. */
  onStore: () => void;
};

/** An open post-game, as the bar in the web's top bar reads it. */
export type CampState = PostgameSource & {
  battleState: BattleState;
  me: BattleParticipant;
  postgame: PostgameDraft;
  draft: BattlePostbattleState;
  save: (next: BattlePostbattleState) => Promise<void>;
  /** "Street Fight, Battle 3". */
  title: string;
  /** "Won against Ash Choir". */
  subtitle: string;
  aftermathPath: string;
  gold: number;
  groups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  /** The warband's resources: what pays an upkeep's resource lines. */
  resources: WarbandResource[];
  /** Something was bought since the battle (a Buy row in the ledger after you finished): Buy ticks. */
  bought: boolean;
  /** `?camp=`: the row picked from the bar, or "ready" while the confirm is open. */
  focus: string | null;
  setCamp: (row: CampRow | "ready" | null) => void;
};

/** An open post-game, as camp reads it. */
export type OpenCamp = CampState & PostgameSlotProps;
