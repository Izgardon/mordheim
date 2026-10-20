import TabSwitcher from "@/components/ui/tab-switcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import UnfinishedBattleBanner from "@/features/battles/components/shared/UnfinishedBattleBanner";

import { useStartBattleForm } from "../../hooks/overview/useStartBattleForm";
import BattleParticipantPicker from "./BattleParticipantPicker";
import ReportResultFields from "./ReportResultFields";

import type { CampaignPlayer } from "../../types/campaign-types";

type StartBattleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  creatorUserId: number;
  players: CampaignPlayer[];
  onBattleCreated?: () => void;
};

const MODE_TABS = [
  { id: "start_battle", label: "Battle" },
  { id: "report_result", label: "Report" },
] as const;

const fieldLabel = "text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground";

/** Start a battle to play, or report one already fought (Report), from the overview. */
export default function StartBattleDialog(props: StartBattleDialogProps) {
  const { open, onOpenChange, campaignId, creatorUserId } = props;
  const form = useStartBattleForm(props);
  const isBattle = form.mode === "start_battle";
  const submitLabel = isBattle
    ? form.isSubmitting
      ? "Creating..."
      : "Create battle"
    : form.isSubmitting
      ? "Submitting..."
      : "Submit result";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[680px]"
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{isBattle ? "Start Battle" : "Report Battle Result"}</DialogTitle>
          <DialogDescription>
            {isBattle
              ? "Select participants, then proceed to prebattle setup."
              : "Select who fought and which warband or warbands won. Everyone else will need to approve it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <UnfinishedBattleBanner campaignId={campaignId} onGo={() => onOpenChange(false)} />
          <TabSwitcher
            tabs={MODE_TABS}
            activeTab={form.mode}
            onTabChange={form.changeMode}
            className="mx-auto"
          />

          <div className="space-y-2">
            <p className={fieldLabel}>Scenario</p>
            <Input
              value={form.scenario}
              onChange={(event) => form.setScenario(event.target.value)}
              placeholder={
                isBattle ? "Breakthrough at the Old Gate..." : "Skirmish at the Market Square..."
              }
              maxLength={120}
            />
          </div>

          {isBattle ? (
            <div className="space-y-2">
              <p className={fieldLabel}>Scenario Link</p>
              <Input
                value={form.scenarioLink}
                onChange={(event) => form.setScenarioLink(event.target.value)}
                placeholder="https://... or example.com/..."
                type="url"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className={fieldLabel}>Battle Date</p>
              <input
                type="date"
                value={form.battleDate}
                onChange={(event) => form.setBattleDate(event.target.value)}
                className="flex h-9 w-full rounded-md border border-border/60 bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.2)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 md:h-11"
              />
            </div>
          )}

          <BattleParticipantPicker
            campaignId={campaignId}
            players={form.eligiblePlayers}
            creatorUserId={creatorUserId}
            selectedUserIds={form.selectedUserIds}
            onToggle={form.toggleUser}
            greyOutBusy={isBattle}
            busyInvitees={form.busyInvitees}
          />

          {isBattle ? null : (
            <ReportResultFields
              participants={form.selectedParticipants}
              winners={form.selectableWinners}
              selectedWinnerIds={form.selectedWinnerWarbandIds}
              onToggleWinner={form.toggleWinner}
              noWinner={form.noWinner}
              onNoWinnerChange={form.chooseNoWinner}
              battleDate={form.battleDate}
            />
          )}

          {form.error ? <p className="text-sm text-red-600">{form.error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={form.isSubmitting}
          >
            Cancel
          </Button>
          <Button variant="default" onClick={form.handleSubmit} disabled={form.submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
