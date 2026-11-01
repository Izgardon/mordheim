import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { RoundAction } from "@/features/battles/api/battles-api";
import type {
  BattleNeutralGroup,
  BattleParticipant,
  BattleRoundRequest,
} from "@/features/battles/types/battle-types";
import { cn } from "@/lib/utils";

type RoundSheetProps = {
  /** "asked": you asked (or agreed) and wait; "incoming": someone asks you. */
  mode: "asked" | "incoming" | null;
  round: number;
  request: BattleRoundRequest | null;
  participants: BattleParticipant[];
  neutralGroups: BattleNeutralGroup[];
  userId: number | undefined;
  /** Start anyway: the battle's creator or a battle manager only (William). */
  canForce: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Not yet": hides the popup until the next ask. */
  onNotYet: () => void;
  onAction: (action: RoundAction) => Promise<unknown>;
};

/**
 * The next round (design E): the asker waits on who has agreed, and can Cancel the ask or, as the
 * battle's creator or a battle manager (William), Start anyway; everyone else gets "Start round
 * N?" with Not yet and Agree. When everyone agrees, or one of them starts it anyway, the round
 * goes up for all players.
 */
export default function RoundSheet({
  mode,
  round,
  request,
  participants,
  neutralGroups,
  userId,
  canForce,
  onOpenChange,
  onNotYet,
  onAction,
}: RoundSheetProps) {
  const [busy, setBusy] = useState(false);
  const next = request?.round ?? round + 1;
  const agreed = new Set(request?.agreed ?? []);
  const asker = participants.find((entry) => entry.user.id === request?.asked_by)?.user.label;
  const fighters = participants.filter((entry) => entry.status === "in_battle");
  const run = (action: RoundAction) => async () => {
    setBusy(true);
    try {
      await onAction(action);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  const votes = [
    ...fighters.map((entry) => ({
      key: `p${entry.id}`,
      name: entry.user.id === userId ? "You" : entry.user.label,
      label: agreed.has(entry.user.id) ? "Agreed" : "Waiting",
      tone: agreed.has(entry.user.id) ? "text-good" : "text-accent-text",
    })),
    ...neutralGroups.map((group) => ({
      key: `n${group.key}`,
      name: `${group.name} · neutral`,
      label: "No vote",
      tone: "text-faint",
    })),
  ];

  return (
    <ModalSheet
      open={mode !== null}
      onOpenChange={onOpenChange}
      kicker={mode === "incoming" ? `${asker ?? "Someone"} asks` : "Next round"}
      title={mode === "incoming" ? `Start round ${next}?` : `Waiting to start round ${next}`}
      className="max-w-[440px]"
      footer={
        mode === "incoming" ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="secondary" className="min-h-12" onClick={onNotYet}>
              Not yet
            </Button>
            <Button className="min-h-12 text-[15px]" disabled={busy} onClick={run("agree")}>
              Agree
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button
              variant="secondary"
              className="min-h-12"
              disabled={busy}
              onClick={request ? run("withdraw") : () => onOpenChange(false)}
            >
              Cancel
            </Button>
            {canForce ? (
              <Button className="min-h-12 text-[15px]" disabled={busy} onClick={run("force")}>
                Start anyway
              </Button>
            ) : (
              <Button className="min-h-12 text-[15px]" onClick={() => onOpenChange(false)}>
                Keep waiting
              </Button>
            )}
          </div>
        )
      }
    >
      {mode === "asked" && !canForce ? (
        <p className="m-0 text-sm text-text2">
          The round starts once everyone agrees. The battle&rsquo;s creator or a battle manager can
          start it anyway.
        </p>
      ) : null}
      {mode === "incoming" ? (
        <p className="m-0 text-sm text-text2">
          Knocked down models stand up. Stunned models become knocked down.
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {votes.map((vote) => (
          <li
            key={vote.key}
            className="flex items-center justify-between border-t border-line py-2"
          >
            <span className="text-sm text-ink">{vote.name}</span>
            <span className={cn("text-[13px] font-bold", vote.tone)}>{vote.label}</span>
          </li>
        ))}
      </ul>
    </ModalSheet>
  );
}
