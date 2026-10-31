import type { PostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type {
  BattleParticipant,
  BattlePostbattleState,
  BattleState,
} from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import type { HenchmenGroup, WarbandHireling } from "../../types/warband-types";

/** Camp's rows (design E), top to bottom; Ready sits under them. */
export type CampRow = "sell" | "recruit" | "hire" | "upkeep" | "buy";

export type PostgameSlotProps = {
  /** "bar": the web's post-game bar; "aside": camp beside the roster, or the phone's card. */
  slot: "bar" | "aside";
  campaignId: number;
  campaign: CampaignSummary | null;
  warbandId: number;
  userId: number | undefined;
  /** Your own warband: someone else's shows no post-game. */
  enabled: boolean;
  isMobile: boolean;
  /** Hire (the Hired swords row). */
  onHire: () => void;
  /** Buy items: opens the store. */
  onStore: () => void;
};

/** An open post-game, as the bar and camp read it. */
export type OpenCamp = PostgameSlotProps & {
  battleState: BattleState;
  me: BattleParticipant;
  postgame: PostgameDraft;
  draft: BattlePostbattleState;
  save: (next: BattlePostbattleState) => Promise<void>;
  subtitle: string;
  aftermathPath: string;
  gold: number;
  groups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  /** Something was bought since the battle (a Buy row in the ledger after you finished): Buy ticks. */
  bought: boolean;
  /** `?camp=`: the row picked from the bar, or "ready" while the confirm is open. */
  focus: string | null;
  setCamp: (row: CampRow | "ready" | null) => void;
};
