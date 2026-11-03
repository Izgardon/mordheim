import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { useAnswerInvitation } from "@/features/battles/hooks/useAnswerInvitation";
import {
  PHASE_ACTION,
  PHASE_STATE,
  type YourOpenBattle,
} from "@/features/battles/utils/open-battles";

type Props = { campaignId: number; battles: YourOpenBattle[] };

/**
 * Your open battles, at the top of the Battles page while you are in more than one (a player can
 * be: busy players are warned, never refused), in the rejoin banner's order: each with where you
 * stand and its way on (Rejoin, Back to pre-battle, To the Aftermath), an invitation with Accept
 * and Decline.
 */
export default function YourOpenBattles(props: Props) {
  return props.battles.length < 2 ? null : <OpenBattleList {...props} />;
}

function OpenBattleList({ campaignId, battles }: Props) {
  const { answer, busy, failure } = useAnswerInvitation(campaignId);

  return (
    <section aria-labelledby="open-battles-h" className="flex flex-col gap-2">
      <h2
        id="open-battles-h"
        className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint"
      >
        Your open battles
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {battles.map(({ state, phase, href, title }) => {
          const battleId = state.battle.id;
          return (
            <li
              key={battleId}
              className="flex flex-wrap items-center justify-between gap-3 border border-accent-line bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-[17px] font-semibold text-head">{title}</span>
                <ChipLabel tone={phase === "fight" ? "danger" : "accent"} className="self-start">
                  {PHASE_STATE[phase]}
                </ChipLabel>
                {failure?.battleId === battleId ? (
                  <span role="alert" className="text-xs text-danger">
                    {failure.message}
                  </span>
                ) : null}
              </div>
              {phase === "invitation" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy !== null}
                    onClick={() => void answer(battleId, "decline")}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void answer(battleId, "accept")}
                  >
                    {busy === battleId ? "Saving…" : "Accept"}
                  </Button>
                </div>
              ) : (
                <Button asChild size="sm">
                  <Link to={href}>{PHASE_ACTION[phase]}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
