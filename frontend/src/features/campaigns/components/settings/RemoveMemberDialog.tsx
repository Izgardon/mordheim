import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";

import type { CampaignMember } from "../../types/campaign-types";

type RemoveMemberDialogProps = {
  open: boolean;
  target: CampaignMember | null;
  error: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RemoveMemberDialog({
  open,
  target,
  error,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove player</DialogTitle>
        </DialogHeader>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isRemoving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isRemoving || !target}>
            {isRemoving ? "Removing..." : "Remove player"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

