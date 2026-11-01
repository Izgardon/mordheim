import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

import { useReadyUpBeforeStart } from "../../hooks/overview/useReadyUpBeforeStart";
import { useStartBattleForm, type BattleDialogMode } from "../../hooks/overview/useStartBattleForm";
import type { CampaignPlayer } from "../../types/campaign-types";
import { READINESS_LABEL, readinessOf } from "./overview-data";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Start battle and Report a result (design E's header buttons): the scenario, who plays (anyone
 * still in a battle or a post-game can be invited, with his state shown; never a block), and for
 * a result the date and the winners or No winner. Starting a battle readies you up: your own open
 * post-game is applied as saved first.
 */
export default function StartBattleDialog({
  mode,
  onClose,
  campaignId,
  userId,
  players,
  onCreated,
}: {
  mode: BattleDialogMode | null;
  onClose: () => void;
  campaignId: number;
  userId: number;
  players: CampaignPlayer[];
  onCreated: () => void;
}) {
  const ready = useReadyUpBeforeStart(campaignId, userId);
  const form = useStartBattleForm({
    open: mode !== null,
    onOpenChange: (open) => (open ? null : onClose()),
    campaignId,
    creatorUserId: userId,
    players,
    initialMode: mode ?? "start_battle",
    beforeStart: ready.readyUp,
    onBattleCreated: onCreated,
  });
  const report = form.mode === "report_result";
  const chosen = new Set([...form.selectedUserIds, userId]);

  return (
    <ModalSheet
      open={mode !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      kicker={report ? "Played already" : "New battle"}
      title={report ? "Report a result" : "Start a battle"}
      footer={
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="min-h-12 text-[15px]"
            disabled={form.submitDisabled}
            onClick={() => void form.handleSubmit()}
          >
            {form.isSubmitting ? "Sending…" : report ? "Report result" : "Start battle"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className={LABEL}>
          Scenario
          <Input value={form.scenario} onChange={(event) => form.setScenario(event.target.value)} />
        </label>
        {report ? (
          <label className={LABEL}>
            Played on
            <Input
              type="date"
              value={form.battleDate}
              onChange={(event) => form.setBattleDate(event.target.value)}
            />
          </label>
        ) : (
          <label className={LABEL}>
            Scenario link (optional)
            <Input
              value={form.scenarioLink}
              placeholder="https://…"
              onChange={(event) => form.setScenarioLink(event.target.value)}
            />
          </label>
        )}
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="pb-1.5 text-xs font-bold text-muted-foreground">Who plays</legend>
          {form.eligiblePlayers.map((player) => {
            const state = readinessOf(player);
            const you = player.id === userId;
            return (
              <label
                key={player.id}
                className={cn(
                  "flex min-h-11 items-center gap-3 border px-3",
                  chosen.has(player.id) ? "border-accent-line bg-accent-soft" : "border-border"
                )}
              >
                <input
                  type="checkbox"
                  checked={chosen.has(player.id)}
                  disabled={you}
                  onChange={() => form.toggleUser(player.id)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-ink">
                    {you ? "You" : player.name} · {player.warband?.name}
                  </span>
                </span>
                {state === "ready" ? null : (
                  <span
                    className={cn("text-xs", state === "post" ? "text-accent-text" : "text-danger")}
                  >
                    {READINESS_LABEL[state]}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
        {report ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">Winners</span>
            <div className="flex flex-wrap gap-1.5">
              {form.selectableWinners.map((warband) => (
                <Chip
                  key={warband.id}
                  pressed={form.selectedWinnerWarbandIds.includes(warband.id)}
                  onClick={() => form.toggleWinner(warband.id)}
                >
                  {warband.name}
                </Chip>
              ))}
              <Chip pressed={form.noWinner} onClick={() => form.chooseNoWinner(!form.noWinner)}>
                No winner
              </Chip>
            </div>
          </div>
        ) : ready.openPostgame ? (
          <p className="m-0 border border-accent-line bg-accent-soft px-3 py-2 text-[13px] text-accent-hi">
            Starting readies you up: your post-game for {ready.openPostgame.battle.scenario} is
            applied as you saved it.
          </p>
        ) : null}
        {form.error ? <p className="m-0 text-sm text-danger">{form.error}</p> : null}
      </div>
    </ModalSheet>
  );
}
