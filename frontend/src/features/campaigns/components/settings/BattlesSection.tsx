import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import { deadlineLabel, idleDuration, idleLabel } from "@/features/battles/utils/battle-timing";
import { cn } from "@/lib/utils";

import { useActiveBattlesSection } from "../../hooks/settings/useActiveBattlesSection";
import { useActiveBattleTools, type ActiveBattleTools } from "../../hooks/useActiveBattleTools";
import type { CampaignActiveBattle } from "../../types/campaign-types";
import { FormError, SettingsCard, Tag } from "./settings-ui";
import { SettingsRowsLoading } from "./SettingsSkeleton";

const STATUS: Record<string, string> = {
  inviting: "Invitations out",
  reported_result_pending: "Result awaiting replies",
  prebattle: "Getting ready",
  active: "Fighting",
  postbattle: "Post-game",
};

const PLAYER_STATUS: Record<string, string> = {
  invited: "invited",
  accepted: "accepted",
  reported_result_pending: "to answer",
  reported_result_approved: "approved",
  reported_result_declined: "declined",
  joined_prebattle: "getting ready",
  ready: "ready",
  canceled_prebattle: "backed out",
  declined: "declined",
  in_battle: "fighting",
  finished_battle: "in his post-game",
  confirmed_postbattle: "done",
};

/** Those still in it: who a battle's results can name. */
const LEFT = new Set(["declined", "canceled_prebattle", "reported_result_declined"]);

/** "Post-game · closes in 2 days · idle 3 days": the idle time the server counted when it sent one. */
function statusLine(entry: CampaignActiveBattle) {
  const { battle } = entry;
  const idle = idleDuration(entry.idle_seconds);
  return [
    STATUS[battle.status] ?? battle.status,
    deadlineLabel(battle, { short: true }),
    idle ? `idle ${idle}` : idleLabel(battle.last_activity_at),
  ]
    .filter(Boolean)
    .join(" · ");
}

const createdOn = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? ""
    : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

type BattleAction = { label: string; danger: boolean; run: () => void };

/** The battle manager's tools that apply to a battle now, as the server's `actions` say. */
function battleActions(entry: CampaignActiveBattle, tools: ActiveBattleTools) {
  const actions = entry.actions ?? {
    end: false,
    confirm_results: false,
    close_postbattle: entry.battle.status === "postbattle",
    cancel: entry.battle.status !== "postbattle",
  };
  return [
    actions.confirm_results
      ? { label: "Review results", danger: false, run: () => tools.askResults(entry, "confirm") }
      : null,
    actions.end
      ? { label: "End the fight", danger: false, run: () => tools.askResults(entry, "end") }
      : null,
    actions.close_postbattle
      ? { label: "Close post-game", danger: true, run: () => tools.askClose(entry) }
      : null,
    actions.cancel ? { label: "Cancel", danger: true, run: () => tools.askCancel(entry) } : null,
  ].filter((action): action is BattleAction => action !== null);
}

/** One open battle: scenario, state, who is in it and how far each got, and the tools. */
function BattleCard({ entry, tools }: { entry: CampaignActiveBattle; tools: ActiveBattleTools }) {
  const { battle } = entry;
  const creator = entry.participants.find(
    (participant) => participant.user.id === battle.created_by_user_id
  );
  const actions = battleActions(entry, tools);
  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 border bg-surface px-4 py-3.5",
        entry.stuck ? "border-accent-line" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-[17px] font-semibold text-head">
          {battle.scenario || `Battle #${battle.id}`}
        </span>
        {battle.flow_type === "reported_result" ? <Tag>Reported result</Tag> : null}
        {entry.stuck ? <Tag tone="accent">Stuck</Tag> : null}
      </div>
      <p className="m-0 text-[13px] text-text2">
        {statusLine(entry)}
        {creator ? ` · started by ${creator.user.label}` : ""}
        {battle.created_at ? ` · ${createdOn(battle.created_at)}` : ""}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {entry.participants.map((participant) => (
          <li key={participant.id} className="flex flex-wrap gap-x-1.5">
            <span className="font-bold text-ink">{participant.warband.name}</span>
            <span className="text-muted-foreground">
              {participant.user.label} · {PLAYER_STATUS[participant.status] ?? participant.status}
            </span>
          </li>
        ))}
      </ul>
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.danger ? "danger" : "secondary"}
              onClick={action.run}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * End a stuck fight or confirm its results: pick the winners among the warbands still in it (none
 * picked is no winner); the others lose.
 */
function ResultsSheet({ tools }: { tools: ActiveBattleTools }) {
  const target = tools.results.target;
  const ending = target?.mode === "end";
  const warbands = (target?.battle.participants ?? []).filter(
    (participant: BattleParticipant) => !LEFT.has(participant.status)
  );
  const [winners, setWinners] = useState<number[]>([]);
  useEffect(() => {
    if (!target) return;
    setWinners(
      target.mode === "end"
        ? target.battle.participants
            .filter((participant) => participant.declared_result === "won")
            .map((participant) => participant.warband.id)
        : (target.battle.battle.winner_warband_ids_json ?? [])
    );
  }, [target]);
  const ids = warbands.map((participant) => participant.warband.id);
  const submit = () =>
    void tools.submitResults({
      winners,
      losers: winners.length ? ids.filter((id) => !winners.includes(id)) : [],
    });
  return (
    <ModalSheet
      open={Boolean(target)}
      onOpenChange={(open) => !open && tools.dismissResults()}
      kicker="Battle manager"
      title={ending ? "End the fight for everyone" : "Review the results"}
      className="max-w-[480px]"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={tools.dismissResults}>
            Back
          </Button>
          <Button className="min-h-12" disabled={tools.results.isSubmitting} onClick={submit}>
            {tools.results.isSubmitting
              ? "Saving…"
              : ending
                ? winners.length
                  ? "End it with these winners"
                  : "End it, no winner"
                : "Confirm the results"}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-sm text-text2">
        {ending
          ? "Everyone still fighting goes to his post-game with these results. Pick the warbands that won; none picked is no winner."
          : "Pick the warbands that won; none picked is no winner. The battle ends once every post-game is done."}
      </p>
      <div className="flex flex-col gap-1.5">
        {warbands.map((participant) => {
          const on = winners.includes(participant.warband.id);
          return (
            <button
              key={participant.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setWinners((list) =>
                  on
                    ? list.filter((id) => id !== participant.warband.id)
                    : [...list, participant.warband.id]
                )
              }
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 border px-3.5 text-left",
                on ? "border-accent-line bg-accent-soft" : "border-border bg-surface"
              )}
            >
              <span className="text-[15px] font-bold text-ink">{participant.warband.name}</span>
              <span className="text-xs text-muted-foreground">
                {on ? "Won" : participant.user.label}
              </span>
            </button>
          );
        })}
      </div>
      <FormError message={tools.results.error} />
    </ModalSheet>
  );
}

/**
 * Settings → Battles (`manage_battles`, BATL-NEW-03): every open battle, stuck ones (idle over a
 * day) first, with the tools that apply now: Review results, End the fight, Close post-game and
 * Cancel, each behind its confirm. The overview's stuck-battles Review lands here.
 */
export default function BattlesSection({ campaignId }: { campaignId: number }) {
  const section = useActiveBattlesSection(campaignId);
  const tools = useActiveBattleTools({
    onCancelBattle: section.onCancelBattle,
    onCloseBattle: section.onCloseBattle,
    onEndBattle: section.onEndBattle,
    onConfirmResults: section.onConfirmResults,
  });
  const battles = [...section.battles].sort(
    (a, b) => Number(Boolean(b.stuck)) - Number(Boolean(a.stuck))
  );
  const close = tools.close.target;
  const unfinished = (close?.participants ?? []).filter(
    (participant) => participant.status === "finished_battle"
  );
  const closeHasWinners = (close?.battle.winner_warband_ids_json ?? []).length > 0;
  const ends = closeHasWinners
    ? "This ends the battle now and records wins and losses."
    : "This ends the battle now; with no winner, no wins or losses are recorded.";

  return (
    <SettingsCard title="Battles" description="A battle idle for over a day is marked Stuck.">
      <FormError message={section.error} />
      {section.isLoading ? (
        <SettingsRowsLoading label="Loading the open battles" rows={2} />
      ) : battles.length === 0 ? (
        <p className="m-0 text-sm text-text2">No open battles or result requests.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {battles.map((entry) => (
            <BattleCard key={entry.battle.id} entry={entry} tools={tools} />
          ))}
        </ul>
      )}
      <ResultsSheet tools={tools} />
      <ConfirmDialog
        open={Boolean(tools.cancel.target)}
        onOpenChange={(open) => !open && tools.dismissCancel()}
        title="Cancel the battle"
        description={
          <p className="m-0 text-ink">
            Cancel{" "}
            <span className="font-bold">
              {tools.cancel.target?.battle.scenario || "this battle"}
            </span>{" "}
            for everyone in it? Nothing from it is recorded.
          </p>
        }
        error={tools.cancel.error}
        cancelText="Back"
        confirmText={tools.cancel.isCanceling ? "Cancelling…" : "Cancel the battle"}
        isConfirming={tools.cancel.isCanceling}
        onConfirm={() => void tools.confirmCancel()}
      />
      <ConfirmDialog
        open={Boolean(close)}
        onOpenChange={(open) => !open && tools.dismissClose()}
        title="Close the post-game"
        description={
          <div className="flex flex-col gap-2">
            <p className="m-0 text-ink">
              {unfinished.length
                ? `${ends} These players haven't finished, so they are skipped: nothing from their post-game is applied, and single-use items they used are still used up:`
                : `Everyone has finished. ${ends}`}
            </p>
            {unfinished.length ? (
              <ul className="m-0 list-disc pl-5">
                {unfinished.map((participant) => (
                  <li key={participant.id}>
                    {participant.user.label} ({participant.warband.name})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        }
        error={tools.close.error}
        cancelText="Back"
        confirmText={tools.close.isClosing ? "Closing…" : "Close the post-game"}
        isConfirming={tools.close.isClosing}
        onConfirm={() => void tools.confirmClose()}
      />
    </SettingsCard>
  );
}
