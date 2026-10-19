import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import type { PostbattleUnitActions } from "@/features/battles/hooks/usePostbattleUnitActions";
import type {
  BattleEvent,
  BattlePostbattleState,
  BattleUnitInformationEntry,
} from "@/features/battles/types/battle-types";

/** What every postbattle roster row reads and changes, passed down once. */
export type PostbattleRowTools = {
  draft: BattlePostbattleState | null;
  isFinalized: boolean;
  actions: PostbattleUnitActions;
  events: BattleEvent[];
  userId: number | undefined;
  baseStatsByUnitKey: Record<string, UnitStats>;
  unitInformation: Record<string, BattleUnitInformationEntry>;
  /** Who a kill took out, for the kill lists (BATL-NEW-06). */
  victimName: (kill: BattleEvent) => string;
};
