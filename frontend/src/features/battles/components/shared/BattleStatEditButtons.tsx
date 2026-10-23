import { Check, RotateCcw } from "lucide-react";

const BUTTON_CLASS =
  "battle-toolbar-button icon-button flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition hover:text-foreground";

/** The battle stat editor's Apply (when the screen saves on apply) and Reset buttons. */
export default function BattleStatEditButtons({
  onApply,
  isApplying = false,
  onReset,
}: {
  onApply?: () => void;
  isApplying?: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      {onApply ? (
        <button
          type="button"
          className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          onClick={onApply}
          disabled={isApplying}
          aria-label={isApplying ? "Applying stat changes" : "Apply stat changes"}
          title={isApplying ? "Applying..." : "Apply"}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={onReset}
        aria-label="Reset temporary stat edits"
        title="Reset temporary stat edits"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
