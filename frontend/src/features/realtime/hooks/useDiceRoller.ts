import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { warbandLogsQuery } from "@/features/warbands/api/economy-queries";
import { markLedgerStale } from "@/features/warbands/api/warband-cache";
import { createWarbandLog } from "@/features/warbands/api/warbands-api";
import { rollDie as rollDieOf, type Dice } from "@/lib/dice";
import { useAppStore } from "@/stores/app-store";

export const DICE = ["D3", "D6", "D8", "D10", "D12", "D20", "D66", "D100"] as const;
export type Die = (typeof DICE)[number];

const random = rollDieOf;
/** One die: D66 is two D6 read as tens and units. */
const rollDie = (die: Die) =>
  die === "D66" ? random(6) * 10 + random(6) : random(Number(die.slice(1)));

/**
 * The dice roller's state, held by whoever places it so it outlives the panel closing: the dice,
 * the modifier and reason, the last roll, and your recent rolls (read while `enabled`). Each roll,
 * rolled here or typed in from the table, goes into your warband's log as a dice roll.
 */
export function useDiceRoller(campaignId: number, enabled: boolean) {
  const { warband } = useAppStore();
  const queryClient = useQueryClient();
  const [count, setCount] = useState(2);
  const [die, setDie] = useState<Die>("D6");
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState("");
  const [last, setLast] = useState<{ faces: number[]; total: number; dice: string } | null>(null);
  const [error, setError] = useState("");
  const logs = useInfiniteQuery({
    ...warbandLogsQuery(campaignId, warband?.id ?? 0, "dice_roll"),
    enabled: enabled && Boolean(warband),
  });
  const recent = (logs.data?.pages[0]?.results ?? []).slice(0, 8);
  const notation = `${count > 1 ? count : ""}${die}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`;

  /** A roll's faces, rolled here or typed in from the table, logged the same way. */
  const record = (faces: number[]) => {
    const total = faces.reduce((sum, face) => sum + face, 0) + modifier;
    setLast({ faces, total, dice: `${count}${die}` });
    setError("");
    if (!warband) return;
    const why = reason.trim();
    void createWarbandLog(warband.id, {
      feature: "dice_roll",
      entry_type: "dice_roll",
      payload: {
        warband: warband.name || "Warband",
        dice: notation,
        rolls: faces,
        total,
        ...(why ? { reason: why } : {}),
      },
    })
      .then(() => {
        markLedgerStale(queryClient, warband.id);
        void logs.refetch();
      })
      .catch(() => setError("Rolled, but the roll couldn't be logged."));
  };

  const roll = () => record(Array.from({ length: count }, () => rollDie(die)));
  // every roll can be typed in (William, 24 Nov 2026: yes, on the main roller too): a box per die;
  // a D66's two boxes make one result, so several D66 roll only
  const typeable: Dice | null =
    die === "D66" ? (count === 1 ? "D66" : null) : (`${count > 1 ? count : ""}${die}` as Dice);
  const fromBoxes = (faces: number[]) =>
    record(die === "D66" ? [(faces[0] ?? 0) * 10 + (faces[1] ?? 0)] : faces);

  return {
    hasWarband: Boolean(warband),
    count,
    setCount,
    die,
    setDie,
    modifier,
    setModifier,
    reason,
    setReason,
    last,
    error,
    recent,
    notation,
    typeable,
    roll,
    fromBoxes,
  };
}

export type DiceRollerState = ReturnType<typeof useDiceRoller>;
