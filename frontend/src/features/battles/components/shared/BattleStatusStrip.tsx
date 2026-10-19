import type { ReactNode } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useBattle } from "@/features/battles/state/battle-context";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import { battleProgress } from "@/features/battles/utils/participant-progress";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  waiting: "text-amber-300",
  done: "text-emerald-300",
  left: "text-muted-foreground",
} as const;

/**
 * Who's holding up the battle (BATL-NEW-08), on every phase page: each player still in it, where
 * they are (Invited, Not ready, Ready, In battle, In postbattle, Finished, Skipped) and how long
 * since they were last seen. `action` fills each player's slot (Nudge).
 */
export default function BattleStatusStrip({
  action,
}: {
  action?: (participant: BattleParticipant) => ReactNode;
}) {
  const { user } = useAuth();
  const { battleState } = useBattle();
  const entries = battleProgress(battleState.participants, battleState.battle.status);
  if (entries.length === 0) {
    return null;
  }
  return (
    <section aria-label="Battle status">
      <ul className="flex flex-wrap gap-2">
        {entries.map(({ participant, progress, idle }) => {
          const isYou = participant.user.id === user?.id;
          return (
            <li
              key={participant.id}
              className="battle-chip flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-3 py-1 text-xs"
              title={participant.warband.name}
            >
              <span className="font-semibold text-foreground">
                {isYou ? "You" : participant.user.label}
              </span>
              <span className={cn("uppercase tracking-[0.14em]", TONE_CLASS[progress.tone])}>
                {progress.label}
              </span>
              {idle ? <span className="text-muted-foreground">{idle}</span> : null}
              {!isYou && action ? action(participant) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
