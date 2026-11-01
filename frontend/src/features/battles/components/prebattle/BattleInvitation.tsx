import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLabel } from "@/components/ui/chip";
import UnfinishedBattleBanner from "@/features/battles/components/shared/UnfinishedBattleBanner";
import type { PrebattlePage } from "@/features/battles/hooks/usePrebattlePage";
import { battleNumberLabel } from "@/features/battles/utils/battle-number";
import { participantProgress } from "@/features/battles/utils/participant-progress";

const TONE = { waiting: "accent", done: "good", left: "danger" } as const;

/**
 * The invitation: who invited you, the scenario and everyone asked, then Accept or
 * Decline. Once you accept it waits for the others; the creator can cancel the battle meanwhile.
 */
export default function BattleInvitation({ page }: { page: PrebattlePage }) {
  const { battle, selection, ready, flags, declining, creatorCancel } = page;
  const { battleState, campaignId, battleId } = battle;
  const { participants } = battleState;
  const me = selection.currentParticipant;
  const inviterId = me?.invited_by_user_id ?? battleState.battle.created_by_user_id;
  const inviter = participants.find((entry) => entry.user.id === inviterId)?.user.label;
  const waitingOn = participants.filter((entry) => entry.status === "invited").length;
  const scenario = battleState.battle.scenario || `Battle #${battleId}`;
  const scenarioLink = battleState.battle.scenario_link;
  const numbered = battleNumberLabel(battleState.battle.number);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 py-4">
      <UnfinishedBattleBanner campaignId={campaignId} excludeBattleId={battleId} />
      <Card as="section" aria-labelledby="invite-title" className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            {[flags.isBattleCreator ? "Your battle" : "Invitation", numbered]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <h1 id="invite-title" className="m-0 font-display text-[26px] font-semibold text-head">
            {scenario}
          </h1>
          <p className="m-0 text-sm text-text2">
            {flags.isBattleCreator
              ? "You called this battle."
              : `${inviter ?? "Another player"} invited you to battle.`}
          </p>
          {scenarioLink ? (
            <a
              href={scenarioLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-accent-text underline underline-offset-2"
            >
              Read the scenario
            </a>
          ) : null}
        </div>

        <ul aria-label="Players" className="m-0 flex list-none flex-col p-0">
          {participants.map((entry) => {
            const progress = participantProgress(entry, battleState.battle.status);
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border-t border-line py-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-[15px] font-semibold text-head">
                    {entry.warband.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.user.id === me?.user.id ? "You" : entry.user.label}
                  </span>
                </span>
                <ChipLabel tone={TONE[progress.tone]}>{progress.label}</ChipLabel>
              </li>
            );
          })}
        </ul>

        {ready.actionError ? <p className="m-0 text-sm text-danger">{ready.actionError}</p> : null}
        {declining.error ? <p className="m-0 text-sm text-danger">{declining.error}</p> : null}

        {flags.canAcceptInvite ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button
              variant="danger"
              className="min-h-12"
              disabled={!flags.canDeclineInvite || declining.isDeclining}
              onClick={() => void declining.decline()}
            >
              {declining.isDeclining ? "Declining…" : "Decline"}
            </Button>
            <Button
              className="min-h-12 text-[15px]"
              disabled={ready.isAcceptingInvite}
              onClick={() => void ready.acceptInvite()}
            >
              {ready.isAcceptingInvite ? "Accepting…" : "Accept"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm text-text2">
              {waitingOn
                ? `Waiting for ${waitingOn} more ${waitingOn === 1 ? "answer" : "answers"}.`
                : "Everyone has answered."}
            </p>
            <div className="flex gap-2">
              {flags.canDeclineInvite ? (
                <Button variant="ghost" onClick={() => void declining.decline()}>
                  Back out
                </Button>
              ) : null}
              {flags.canCreatorCancelBattle ? (
                <Button variant="danger" onClick={() => creatorCancel.setIsOpen(true)}>
                  Cancel battle
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
