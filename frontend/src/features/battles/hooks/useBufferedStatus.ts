import { useCallback, useEffect, useRef, useState } from "react";

import {
  nextStatus,
  type BattleSections,
  type BattleUnitView,
  type UnitStatus,
} from "@/features/battles/components/battle/battle-units";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";

/**
 * How long after the last tap a unit's status goes to the server (William, 26 Nov 2026: "add
 * buffer time when clicking a units status in the battle so someone can quickly cycle to out of
 * action before it requests the server").
 */
export const STATUS_BUFFER_MS = 900;

type Pending = { from: UnitStatus; timer: ReturnType<typeof setTimeout> };

/**
 * Taps on a status button cycle it on the card at once, and only where it ends up is sent, once
 * the taps stop: Standing → Knocked down → Stunned → Out of action is one request, and cycling
 * back to where it started sends none. A page left with taps waiting sends them straight away.
 */
export function useBufferedStatus(
  send: (key: string, from: UnitStatus, to: UnitStatus) => Promise<unknown> | void,
  delay = STATUS_BUFFER_MS
) {
  const [shown, setShown] = useState<Record<string, UnitStatus>>({});
  const waiting = useRef(new Map<string, Pending>());
  const sendRef = useRef(send);
  sendRef.current = send;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const settle = useCallback(async (key: string) => {
    const pending = waiting.current.get(key);
    const to = shownRef.current[key];
    waiting.current.delete(key);
    if (pending && to && to !== pending.from) await sendRef.current(key, pending.from, to);
    if (!waiting.current.has(key)) {
      setShown(({ [key]: _done, ...rest }) => rest); // the server's answer shows from here
    }
  }, []);

  /** One tap: the card moves on from what it shows now, and the send waits for the last tap. */
  const cycle = useCallback(
    (key: string, current: UnitStatus) => {
      const from = shownRef.current[key] ?? current;
      const next = nextStatus(from);
      const pending = waiting.current.get(key);
      if (pending) clearTimeout(pending.timer);
      waiting.current.set(key, {
        from: pending?.from ?? current,
        timer: setTimeout(() => void settle(key), delay),
      });
      shownRef.current = { ...shownRef.current, [key]: next };
      setShown(shownRef.current);
    },
    [delay, settle]
  );

  useEffect(
    () => () => {
      for (const [key, pending] of waiting.current) {
        clearTimeout(pending.timer);
        const to = shownRef.current[key];
        if (to && to !== pending.from) void sendRef.current(key, pending.from, to);
      }
      waiting.current.clear();
    },
    []
  );

  /** The status a card shows: the one tapped to, else the server's. */
  const statusOf = useCallback((key: string, server: UnitStatus) => shown[key] ?? server, [shown]);

  return { cycle, statusOf, shown };
}

type StatusOf = (key: string, server: UnitStatus) => UnitStatus;

const showing = (view: BattleUnitView, statusOf: StatusOf): BattleUnitView => {
  const status = statusOf(view.unit.key, view.status);
  return status === view.status ? view : { ...view, status };
};

/** Your units as the cards show them: a status still being tapped through in place of the server's. */
export function sectionsShowing(sections: BattleSections, statusOf: StatusOf): BattleSections {
  return {
    heroes: sections.heroes.map((view) => showing(view, statusOf)),
    groups: sections.groups.map((entry) => ({
      ...entry,
      members: entry.members.map((view) => showing(view, statusOf)),
    })),
    swords: sections.swords.map((view) => showing(view, statusOf)),
    pets: sections.pets.map((view) => showing(view, statusOf)),
    temporary: sections.temporary.map((view) => showing(view, statusOf)),
  };
}

/** A neutral group as its tiles show it, the same way. */
export function groupShowing(group: BattleNeutralGroup, statusOf: StatusOf): BattleNeutralGroup {
  return {
    ...group,
    creatures: group.creatures.map((creature) => ({
      ...creature,
      status: statusOf(creature.key, creature.status),
    })),
  };
}
