import { createContext, useContext } from "react";

import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleStateRef } from "@/features/battles/hooks/useBattleState";
import type { BattlePhase } from "@/features/battles/state/battle-machine";
import type { BattleState } from "@/features/battles/types/battle-types";

/** What `BattleLayout` shares with the page it shows, once the battle is loaded and on it. */
export type BattleContextValue = {
  campaignId: number;
  battleId: number;
  /** The page being shown. */
  phase: BattlePhase;
  battleState: BattleState;
  /** The latest cached state, optimistic changes included, for reads outside a render. */
  battleStateRef: BattleStateRef;
  rosters: Record<number, ParticipantRoster>;
  rosterLoading: Record<number, boolean>;
  rosterErrors: Record<number, string>;
  /** Merges a write's answer into the cached state. */
  applyBattleResponse: (next: BattleState) => void;
  /** Changes the cached state in place (optimistic edits). */
  updateBattleState: (updater: (previous: BattleState | null) => BattleState | null) => void;
  /** Reads the events after the cached ones, in the shown page's view. */
  refreshBattleState: () => Promise<void>;
};

export const BattleContext = createContext<BattleContextValue | null>(null);

/** The battle a page shows; only inside `BattleProvider`, which `BattleLayout` renders. */
export function useBattle() {
  const value = useContext(BattleContext);
  if (!value) {
    throw new Error("useBattle is only available inside BattleProvider (BattleLayout).");
  }
  return value;
}
