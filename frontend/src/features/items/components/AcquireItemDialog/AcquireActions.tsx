import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { Tooltip } from "@components/tooltip";

type OverspendConfirm = {
  open: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

type AcquireActionsProps = {
  isBuying: boolean;
  isSubmitting: boolean;
  actionDisabled: boolean;
  actionDisabledReason: string;
  notice: string;
  onAcquire: () => void;
  onCancel: () => void;
  /** Decision 2: spending more than the warband has is confirmed first, never refused. */
  overspendConfirm: OverspendConfirm;
};

/** Cancel and Buy/Give, with what stops Buy or Give in a tooltip and under the buttons. */
export default function AcquireActions({
  isBuying,
  isSubmitting,
  actionDisabled,
  actionDisabledReason,
  notice,
  onAcquire,
  onCancel,
  overspendConfirm,
}: AcquireActionsProps) {
  const label = isSubmitting ? (isBuying ? "Buying..." : "Giving...") : isBuying ? "Buy" : "Give";
  return (
    <>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        {actionDisabledReason ? (
          <Tooltip
            trigger={
              <span className="inline-flex cursor-not-allowed">
                <Button
                  onClick={onAcquire}
                  disabled={actionDisabled}
                  className="pointer-events-none"
                >
                  {label}
                </Button>
              </span>
            }
            content={actionDisabledReason}
            className="inline-flex"
          />
        ) : (
          <Button onClick={onAcquire} disabled={actionDisabled}>
            {label}
          </Button>
        )}
      </div>
      <p className="min-h-[1rem] text-xs text-muted-foreground" aria-live="polite">
        {notice || " "}
      </p>
      <ConfirmDialog
        open={overspendConfirm.open}
        onOpenChange={overspendConfirm.onOpenChange}
        description={`${overspendConfirm.message} Buy it anyway?`}
        confirmText="Buy anyway"
        cancelText="Go Back"
        onConfirm={overspendConfirm.onConfirm}
      />
    </>
  );
}
