import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";

/** What finalising would apply; skipping applies none of it. */
export type SkippedPostbattleSummary = {
  resourceAmount: number;
  resourceName: string | null;
  findsGoldCrowns: number;
  findsItems: { name: string }[];
  xpAwards: { unitKey: string; unitName: string; xpEarned: number }[];
  kills: { unitKey: string; unitName: string; killCount: number }[];
  deaths: { unitKey: string; unitName: string }[];
  upkeepTotal: number;
  payUpkeep: boolean;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** One line per kind of result, e.g. "XP: Captain Wolf +3, Rolf +1". */
export function skippedPostbattleLines(summary: SkippedPostbattleSummary) {
  const finds = [
    ...(summary.findsGoldCrowns > 0 ? [`${summary.findsGoldCrowns} gc`] : []),
    ...summary.findsItems.map((item) => item.name),
  ];
  const lines = [
    summary.resourceName && summary.resourceAmount > 0
      ? `Exploration: ${summary.resourceAmount} ${summary.resourceName}`
      : null,
    finds.length > 0 ? `Finds: ${finds.join(", ")}` : null,
    summary.xpAwards.length > 0
      ? `XP: ${summary.xpAwards.map((row) => `${row.unitName} +${row.xpEarned}`).join(", ")}`
      : null,
    summary.kills.length > 0
      ? `Kills: ${summary.kills
          .map((row) => `${row.unitName} ${plural(row.killCount, "kill")}`)
          .join(", ")}`
      : null,
    summary.deaths.length > 0
      ? `Deaths: ${summary.deaths.map((row) => row.unitName).join(", ")}`
      : null,
    summary.payUpkeep && summary.upkeepTotal > 0 ? `Upkeep: ${summary.upkeepTotal} gc` : null,
  ];
  return lines.filter((line): line is string => line !== null);
}

type PostbattleSkipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warbandName: string;
  summary: SkippedPostbattleSummary;
  isSkipping: boolean;
  error: string;
  onConfirm: () => void;
};

/** Skip postbattle (BUG-48): says plainly that nothing on the page will be applied, and what. */
export default function PostbattleSkipDialog({
  open,
  onOpenChange,
  warbandName,
  summary,
  isSkipping,
  error,
  onConfirm,
}: PostbattleSkipDialogProps) {
  const lines = skippedPostbattleLines(summary);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Skip postbattle</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            {warbandName} leaves this battle without its postbattle. You can&apos;t come back to it,
            and nothing from this page will be applied.
          </DialogDescription>
        </DialogHeader>
        {lines.length > 0 ? (
          <div className="battle-inline-panel space-y-2 p-4">
            <p className="battle-section-title">Not applied</p>
            <ul className="space-y-1 text-sm text-foreground">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSkipping}
          >
            Back
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isSkipping}>
            {isSkipping ? "Skipping..." : "Skip postbattle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
