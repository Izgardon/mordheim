import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import CustomUnitFields from "@/features/battles/components/shared/CustomUnitFields";
import type { PrebattlePage } from "@/features/battles/hooks/usePrebattlePage";
import { participantProgress } from "@/features/battles/utils/participant-progress";
import { cn } from "@/lib/utils";

import PrebattleUnits from "./PrebattleUnits";

const TONE = { waiting: "accent", done: "good", left: "danger" } as const;

type PrebattleBodyProps = {
  page: PrebattlePage;
  isMobile: boolean;
  onOpenNotes: () => void;
};

/**
 * The pre-battle, built plainly on today's hooks: the units you bring with their
 * battle stat changes and temporary units, your rating, everyone's state, then Ready (and Start
 * and Cancel for the creator). Leaving the page takes your Ready back, as today.
 */
export default function PrebattleBody({ page, isMobile, onOpenNotes }: PrebattleBodyProps) {
  const { battle, selection, isOwnSelected, config, ratings, ready, visible, flags } = page;
  const { start, creatorCancel } = page;
  const { battleState, rosters, rosterErrors } = battle;
  const { participants } = battleState;
  const me = selection.currentParticipant;
  const shown = selection.selectedParticipant;
  const shownRoster = shown ? rosters[shown.user.id] : undefined;
  const readyCount = participants.filter((entry) => entry.status === "ready").length;
  const counted = participants.filter(
    (entry) => entry.status !== "declined" && entry.status !== "canceled_prebattle"
  ).length;
  const myRating = me ? (ratings.ratingInputsByUserId[me.user.id] ?? "") : "";
  const editable = flags.canEditOwnConfig ? config : undefined;
  const draft = config.customUnitDraft;
  const picked = config.ownUnitKeys.filter((key) => config.selectedUnitKeys.includes(key)).length;

  const everyone = (
    <Card as="section" aria-labelledby="everyone-h" className="flex flex-col p-4">
      <div className="flex items-baseline justify-between pb-1">
        <h2 id="everyone-h" className="m-0 font-display text-lg font-semibold text-head">
          Everyone
        </h2>
        <span className="text-xs text-muted-foreground">
          {readyCount} of {counted} ready
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {participants.map((entry) => {
          const progress = participantProgress(entry, battleState.battle.status);
          const rating = ratings.statusRatingByUserId[entry.user.id];
          const selected = shown?.id === entry.id;
          return (
            <li key={entry.id} className="border-t border-line">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => selection.setSelectedParticipantUserId(entry.user.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left",
                  selected && "bg-accent-soft"
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-[15px] font-semibold text-head">
                    {entry.warband.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.user.id === me?.user.id ? "You" : entry.user.label}
                    {rating !== null && rating !== undefined ? ` · rating ${rating}` : ""}
                    {` · ${entry.selected_unit_keys_json.length} units`}
                  </span>
                </span>
                <ChipLabel tone={TONE[progress.tone]}>{progress.label}</ChipLabel>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const actions = (
    <div className={cn("flex gap-2", isMobile ? "" : "flex-wrap")}>
      {flags.canCreatorCancelBattle ? (
        <Button
          variant="danger"
          className="min-h-12"
          disabled={creatorCancel.isCanceling}
          onClick={() => creatorCancel.setIsOpen(true)}
        >
          {isMobile ? "Cancel" : "Cancel battle"}
        </Button>
      ) : null}
      {me ? (
        <Button
          variant={flags.currentUserReady ? "secondary" : "primary"}
          className="min-h-12 flex-1 text-[15px]"
          disabled={flags.readyDisabled || ready.isUpdatingReady}
          onClick={() => void ready.toggleReady()}
        >
          {ready.isUpdatingReady ? "Saving…" : flags.currentUserReady ? "Not ready" : "Ready"}
        </Button>
      ) : null}
      {flags.showStart ? (
        <Button
          className="min-h-12 flex-1 text-[15px]"
          disabled={flags.startDisabled}
          onClick={() => start.setIsOpen(true)}
        >
          {start.isStarting ? "Starting…" : "Start battle"}
        </Button>
      ) : null}
    </div>
  );

  const units = !shown ? null : rosterErrors[shown.user.id] ? (
    <p className="m-0 text-sm text-danger">{rosterErrors[shown.user.id]}</p>
  ) : !shownRoster ? (
    <p className="m-0 text-sm text-muted-foreground">Reading the roster…</p>
  ) : (
    <PrebattleUnits
      roster={shownRoster}
      customUnits={visible.customUnits}
      selectedKeys={visible.selectedKeys}
      overrides={visible.overrides}
      config={isOwnSelected ? editable : undefined}
    />
  );

  return (
    <div className={cn("flex flex-col gap-4 py-3", isMobile && "pb-28")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            Before the battle
          </span>
          <h1 className="m-0 font-display text-[26px] font-semibold text-head">
            {battleState.battle.scenario || `Battle #${battleState.battle.id}`}
          </h1>
          <p className="m-0 text-sm text-text2">
            {flags.currentUserReady
              ? "You're ready. Waiting for the others."
              : "Pick who you bring, then say you're ready."}
          </p>
        </div>
        {isMobile ? null : (
          <div className="flex gap-2">
            {me ? (
              <Button variant="secondary" onClick={onOpenNotes}>
                Battle notes
              </Button>
            ) : null}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <Card as="section" aria-labelledby="units-h" className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="units-h" className="m-0 font-display text-lg font-semibold text-head">
                {isOwnSelected ? "Your units" : `${shown?.warband.name ?? "Their"} units`}
              </h2>
              {isOwnSelected ? (
                <span className="text-xs text-muted-foreground">{picked} picked</span>
              ) : (
                <span className="text-xs text-muted-foreground">View only</span>
              )}
            </div>
            {units}
            {isOwnSelected && editable ? (
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                {draft.isOpen ? (
                  <>
                    <CustomUnitFields draft={draft} />
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={draft.close}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (config.addCustomUnit()) ready.setActionError("");
                        }}
                      >
                        Add the unit
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    className="self-start border-dashed text-accent-text"
                    onClick={draft.toggleOpen}
                  >
                    Add a temporary unit
                  </Button>
                )}
              </div>
            ) : null}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          {everyone}
          {me ? (
            <Card as="section" aria-labelledby="rating-h" className="flex flex-col gap-2 p-4">
              <h2 id="rating-h" className="m-0 font-display text-lg font-semibold text-head">
                Your rating
              </h2>
              <Input
                aria-label="Your rating"
                inputMode="numeric"
                value={myRating}
                disabled={!flags.canEditOwnConfig}
                onChange={(event) => ratings.setRatingInput(me.user.id, event.target.value)}
                className="max-w-[160px] font-mono"
              />
              <p className="m-0 text-xs text-muted-foreground">
                Temporary units add their own rating to it.
              </p>
            </Card>
          ) : null}
          {ready.actionError ? (
            <p className="m-0 text-sm text-danger">{ready.actionError}</p>
          ) : null}
          {isMobile ? null : actions}
        </aside>
      </div>

      {isMobile ? (
        <footer className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] z-10 border-t border-line bg-rail px-3 py-2.5">
          {actions}
        </footer>
      ) : null}
    </div>
  );
}
