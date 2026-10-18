import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { DialogFooter } from "@components/dialog";

type TradeActionsProps = {
  myAccepted: boolean;
  /** Your edits aren't saved yet: Accept would lock the server's older copy. */
  hasUnsavedOffer: boolean;
  isLocking: boolean;
  isUnlocking: boolean;
  onAccept: () => void;
  onUnaccept: () => void;
  /** Cancel, once confirmed: ends the trade for both sides. */
  onCancel: () => void;
};

/** Cancel (with a confirmation), and Accept or Unaccept your side. */
export default function TradeActions({
  myAccepted,
  hasUnsavedOffer,
  isLocking,
  isUnlocking,
  onAccept,
  onUnaccept,
  onCancel,
}: TradeActionsProps) {
  // Kept here, so it goes with the dialog when the trade ends (completed, cancelled, expired)
  // and never greets the next trade.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  return (
    <>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={() => setShowCancelConfirm(true)}>
          Cancel
        </Button>
        {myAccepted ? (
          <Button type="button" variant="secondary" onClick={onUnaccept} disabled={isUnlocking}>
            {isUnlocking ? "Unaccepting..." : "Unaccept"}
          </Button>
        ) : (
          // Accept locks the server's copy, so it waits until your changes are saved.
          <Button type="button" onClick={onAccept} disabled={hasUnsavedOffer || isLocking}>
            {isLocking ? "Accepting..." : "Accept"}
          </Button>
        )}
      </DialogFooter>
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        description="Are you sure you want to cancel this trade? Both sides will lose their offers."
        confirmText="Cancel Trade"
        cancelText="Go Back"
        onConfirm={() => {
          // The dialog stays mounted on the page: a confirmed prompt mustn't greet the next trade.
          setShowCancelConfirm(false);
          onCancel();
        }}
      />
    </>
  );
}
