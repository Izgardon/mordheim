import { useState } from "react";

import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Input } from "@components/input";

type DeleteForGoodDialogProps = {
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  error: string;
  onDelete: (typedName: string) => void;
};

/**
 * Delete an archived campaign for good (CAMP-TWEAK-04): it says everything that goes, and waits
 * for the campaign's name, typed as it is spelt (surrounding spaces don't count).
 */
export default function DeleteForGoodDialog({
  campaignName,
  open,
  onOpenChange,
  isDeleting,
  error,
  onDelete,
}: DeleteForGoodDialogProps) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === campaignName;

  const changeOpen = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Delete for good</DialogTitle>
          <DialogDescription>
            {`${campaignName} and everything in it goes, for every member. This can't be undone.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Deleted with it: all warbands and their units, all battles and their records, trades,
            logs and ledgers, house rules and their house-rule items, custom wargear, skills, spells
            and bestiary entries, the chat and the bulletin, and its notifications.
          </p>
          <label className="block space-y-1">
            <span className="text-foreground">{`Type ${campaignName} to confirm`}</span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              disabled={isDeleting}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => changeOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || isDeleting}
            onClick={() => onDelete(typed)}
          >
            {isDeleting ? "Deleting..." : "Delete for good"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
