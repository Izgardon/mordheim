import { BellRing } from "lucide-react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useNudge } from "@/features/battles/hooks/useNudge";
import { useBattle } from "@/features/battles/state/battle-context";
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
 * since their last activity, with Nudge for a player the battle is waiting for (one per 10
 * minutes; the button says when you can again).
 */
export default function BattleStatusStrip() {
  const { user } = useAuth();
  const { campaignId, battleId, battleState, capabilities, applyBattleResponse } = useBattle();
  const nudging = useNudge({
    campaignId,
    battleId,
    events: battleState.events,
    userId: user?.id,
    applyBattleResponse,
  });
  const entries = battleProgress(battleState.participants, battleState.battle.status);
  if (entries.length === 0) {
    return null;
  }
  return (
    <section aria-label="Battle status">
      <ul className="flex flex-wrap gap-2">
        {entries.map(({ participant, progress, idle }) => {
          const isYou = participant.user.id === user?.id;
          const label = participant.user.label;
          const canNudge = !isYou && progress.tone === "waiting" && Boolean(capabilities?.nudge);
          const waitMinutes = Math.ceil(nudging.waitFor(participant.user.id) / 60_000);
          return (
            <li
              key={participant.id}
              className="battle-chip flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-3 py-1 text-xs"
              title={participant.warband.name}
            >
              <span className="font-semibold text-foreground">{isYou ? "You" : label}</span>
              <span className={cn("uppercase tracking-[0.14em]", TONE_CLASS[progress.tone])}>
                {progress.label}
              </span>
              {idle ? <span className="text-muted-foreground">{idle}</span> : null}
              {canNudge ? (
                <button
                  type="button"
                  className="battle-toolbar-button flex min-h-9 items-center gap-1 rounded px-2 text-[0.65rem] uppercase tracking-[0.12em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={waitMinutes > 0 || nudging.sendingTo === participant.user.id}
                  onClick={() => void nudging.nudge(participant.user.id, label)}
                  aria-label={
                    waitMinutes > 0
                      ? `${label} nudged; again in ${waitMinutes} min`
                      : `Nudge ${label}`
                  }
                >
                  <BellRing className="h-3 w-3" aria-hidden="true" />
                  {waitMinutes > 0 ? `Again in ${waitMinutes} min` : "Nudge"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
