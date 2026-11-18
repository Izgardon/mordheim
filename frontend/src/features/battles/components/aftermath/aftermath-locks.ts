import type {
  AftermathStep,
  BattlePostbattleApplied,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";

/**
 * What the aftermath has already handed over, as the page reads it from the server's record
 * (`postbattle_json.aftermath`; the server decides, apps/battles/services/postbattle/steps.py).
 *
 * William, 18 Nov 2026, on going back to a step: "maybe we can lock the item and gold section, the
 * number of wyrdstone received but still allow the other things to be edited and dice numbers to
 * change for exploration purposes." So the gold and items found are settled and read-only, and
 * everything else is still editable: a change there changes the battle's record, and the warband is
 * changed on the unit's own card.
 */
export type AftermathLocks = {
  /** The steps already in the warband. */
  applied: AftermathStep[];
  /** His aftermath is finished: nothing prompts him for it again. */
  done: boolean;
  /** The injuries have been applied: a change here is the record's only. */
  injuries: boolean;
  /** The experience and advances have been applied. */
  xp: boolean;
  /** The shards, gold and items have been handed over: the finds are read-only. */
  explore: boolean;
  /** What the explore step gave him, for the settled line. */
  received: BattlePostbattleApplied["received"];
};

export const NO_LOCKS: AftermathLocks = {
  applied: [],
  done: false,
  injuries: false,
  xp: false,
  explore: false,
  received: {},
};

export function aftermathLocks(draft: BattlePostbattleState | null): AftermathLocks {
  const record = draft?.aftermath;
  if (!record) return NO_LOCKS;
  const applied = record.applied ?? [];
  return {
    applied,
    done: record.done_at !== null,
    injuries: applied.includes("injuries"),
    xp: applied.includes("xp"),
    explore: applied.includes("explore"),
    received: record.received ?? {},
  };
}

/** "5 Wyrdstone, 20 gc and 2 items": what the explore step handed over, for the settled line. */
export function receivedLine(received: AftermathLocks["received"]) {
  const items = received.items ?? 0;
  const shards = received.shards ?? 0;
  const parts = [
    shards ? `${shards} ${received.resource || `shard${shards === 1 ? "" : "s"}`}` : null,
    received.gold ? `${received.gold} gc` : null,
    items ? `${items} ${items === 1 ? "item" : "items"}` : null,
  ].filter(Boolean) as string[];
  if (!parts.length) return "Nothing was found";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
