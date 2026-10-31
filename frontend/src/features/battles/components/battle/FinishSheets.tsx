import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { finishBattle, type DeclaredResult } from "@/features/battles/api/battles-api";
import type { FinishMineState } from "@/features/battles/hooks/useFinishMine";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

const RESULTS: { id: DeclaredResult; label: string; detail: string }[] = [
  { id: "won", label: "I won", detail: "Your warband held the field" },
  { id: "lost", label: "I lost", detail: "You routed or were wiped out" },
  { id: "undecided", label: "Decide when it ends", detail: "A draw, or not sure yet" },
];

const choice = (on: boolean) =>
  cn(
    "flex min-h-[52px] flex-col justify-center border px-3 text-left",
    on ? "border-accent-line bg-accent-soft" : "border-border bg-transparent"
  );

/**
 * End my battle (today's finish, decision 4): say how it went and your Aftermath opens while the
 * others play on. The last player to finish confirms the results there.
 */
export function FinishSheet({ finishing }: { finishing: FinishMineState }) {
  return (
    <ModalSheet
      open={finishing.isOpen}
      onOpenChange={finishing.setIsOpen}
      kicker="End my battle"
      title="How did it go?"
      className="max-w-[480px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            onClick={() => finishing.setIsOpen(false)}
          >
            Keep fighting
          </Button>
          <Button
            className="min-h-12 text-[15px]"
            disabled={!finishing.result || finishing.isFinishing}
            onClick={() => void finishing.finish()}
          >
            {finishing.isFinishing ? "Finishing…" : "End my battle"}
          </Button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Result" className="flex flex-col gap-1.5">
        {RESULTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={finishing.result === entry.id}
            onClick={() => finishing.setResult(entry.id)}
            className={choice(finishing.result === entry.id)}
          >
            <span className="text-[15px] font-bold text-ink">{entry.label}</span>
            <span className="text-xs text-muted-foreground">{entry.detail}</span>
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Your Aftermath opens now; the others can keep fighting.
      </p>
      {finishing.error ? <p className="m-0 text-sm text-danger">{finishing.error}</p> : null}
    </ModalSheet>
  );
}

/**
 * A battle manager ends a stuck fight for everyone (BATL-NEW-03): the warbands that won, the rest
 * lost, or none for no winner. Everyone still fighting goes to his Aftermath.
 */
export function EndFightSheet({
  open,
  onOpenChange,
  campaignId,
  battleId,
  participants,
  applyBattleResponse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  battleId: number;
  participants: BattleParticipant[];
  applyBattleResponse: (next: BattleState) => void;
}) {
  const [winners, setWinners] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setWinners([]);
      setError("");
    }
  }, [open]);
  const warbands = participants.filter((entry) =>
    ["in_battle", "finished_battle"].includes(entry.status)
  );
  const end = async () => {
    setSaving(true);
    setError("");
    try {
      const ids = warbands.map((entry) => entry.warband.id);
      applyBattleResponse(
        await finishBattle(campaignId, battleId, {
          winners,
          losers: winners.length ? ids.filter((id) => !winners.includes(id)) : [],
        })
      );
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't end the fight."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Battle manager"
      title="End the fight for everyone"
      className="max-w-[480px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="min-h-12"
            disabled={saving}
            onClick={() => void end()}
          >
            {saving
              ? "Ending…"
              : winners.length
                ? "End it with these winners"
                : "End it, no winner"}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-sm text-text2">
        Pick the warbands that won. None picked is no winner.
      </p>
      <div className="flex flex-col gap-1.5">
        {warbands.map((entry) => {
          const on = winners.includes(entry.warband.id);
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setWinners(
                  on
                    ? winners.filter((id) => id !== entry.warband.id)
                    : [...winners, entry.warband.id]
                )
              }
              className={choice(on)}
            >
              <span className="text-[15px] font-bold text-ink">{entry.warband.name}</span>
              <span className="text-xs text-muted-foreground">{entry.user.label}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
