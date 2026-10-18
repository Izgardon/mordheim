import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The creator's Cancel Battle confirm on the active page, with an "I understand" tick. */
export default function ActiveCancelBattleDialog({
  open,
  onOpenChange,
  isCanceling,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCanceling: boolean;
  error: string;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cancel Battle</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <DialogDescription asChild className="block">
            <p>Cancel this battle for all participants?</p>
          </DialogDescription>
          <label className="battle-inline-panel mt-3 flex items-start gap-3 rounded-xl px-3 py-2 text-sm text-foreground">
            <Checkbox
              checked={confirmed}
              disabled={isCanceling}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            <span>I understand this will cancel the battle for all participants.</span>
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isCanceling}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isCanceling || !confirmed}
          >
            {isCanceling ? "Canceling..." : "Cancel battle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
