import type {
  BattleEvent,
  BattleEventType,
  BattleParticipant,
  BattlePostbattleRules,
  BattlePostbattleSuggestion,
  BattleStatus,
  BattleSummary,
  BroadcastCapabilities,
} from "@/features/battles/types/battle-types";

/**
 * What `battle.event` carries on `private-battle-<id>` (PERF-34, `services/broadcast.py`): one
 * message per event a write added, or one `battle_state_updated` for a write that added none.
 * Every message has the write's `state_version`; the write's last message also carries the battle
 * and the participants it changed (all of them for a phase change), unless that would pass
 * Pusher's size limit (`snapshot_omitted`). Messages from an older server have no version.
 */
type BattleMessageSnapshot = {
  state_version?: number;
  battle?: BattleSummary;
  participants?: BattleParticipant[];
  snapshot_omitted?: boolean;
  /** Each player's flags and a battle manager's, so a status change needs no read. */
  capabilities?: BroadcastCapabilities;
  /**
   * When a write puts players into postbattle or changes its winners: each one's suggestions and
   * the rules, as much as fits (`rules_omitted`; `postbattle_omitted` when none did).
   */
  postbattle?: {
    rules?: BattlePostbattleRules;
    suggested?: Record<string, BattlePostbattleSuggestion>;
    rules_omitted?: boolean;
  };
  postbattle_omitted?: boolean;
};

/** A timeline event (a kill, an item use, the battle starting...). */
export type BattleTimelineMessage = BattleMessageSnapshot & {
  type: BattleEventType;
  payload: BattleEvent;
};

/** A write that added no event (a config save, a ready change, a join). */
export type BattleStateUpdatedMessage = BattleMessageSnapshot & {
  type: "battle_state_updated";
  payload: {
    battle_id: number;
    campaign_id: number;
    status: BattleStatus;
    actor_user_id: number | null;
    reason?: string;
    state_version?: number;
  };
};

export type BattleSocketMessage = BattleTimelineMessage | BattleStateUpdatedMessage;
