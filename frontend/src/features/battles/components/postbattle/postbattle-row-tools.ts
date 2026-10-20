import type { PostbattleUnitActions } from "@/features/battles/hooks/usePostbattleUnitActions";
import type {
  BattleEvent,
  BattlePostbattleState,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";

/** What every postbattle roster row reads and changes, passed down once. */
export type PostbattleRowTools = {
  draft: BattlePostbattleState | null;
  isFinalized: boolean;
  actions: PostbattleUnitActions;
  events: BattleEvent[];
  userId: number | undefined;
  /** Who a kill took out, for the kill lists (BATL-NEW-06). */
  victimName: (kill: BattleEvent) => string;
  /** The server's suggestions, for each XP field's "why" (BATL-NEW-09). */
  suggestion: BattlePostbattleSuggestion | undefined;
};
