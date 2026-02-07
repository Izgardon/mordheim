import { useState } from "react";
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
  SimpleDialogContent,
} from "@components/dialog";
import { ExitIcon } from "@components/exit-icon";
import { Input } from "@components/input";

import { deleteWarband } from "../../../warbands/api/warbands-api";

type DeleteWarbandCardProps = {
  warbandId: number;
  warbandName: string;
  onDeleted: () => void;
};

export default function DeleteWarbandCard({
  warbandId,
  warbandName,
  onDeleted,
}: DeleteWarbandCardProps) {
  const [open, setOpen] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isDeleteReady = deleteValue.toLowerCase() === "delete";

  const handleReset = () => {
    setDeleteValue("");
    setDeleteError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      handleReset();
    }
  };

  const handleDelete = async () => {
    if (!isDeleteReady) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteWarband(warbandId);
      setOpen(false);
      onDeleted();
    } catch (err) {
      if (err instanceof Error) {
        setDeleteError(err.message || "Failed to delete warband");
      } else {
        setDeleteError("Failed to delete warband");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <CardBackground className="space-y-4 p-6">
      <h3 className="text-lg font-semibold text-destructive">Delete warband</h3>
      <p className="text-sm text-muted-foreground">
        Permanently delete <span className="font-semibold text-foreground">{warbandName}</span> and all its heroes.
      </p>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="destructive">Delete warband</Button>
        </DialogTrigger>
        <SimpleDialogContent className="max-w-[400px]">
          <DialogTitle className="sr-only">Confirm deletion</DialogTitle>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="icon-button absolute right-1 top-1 transition-[filter] hover:brightness-125"
            aria-label="Close"
          >
            <ExitIcon className="h-6 w-6" />
          </button>
          <p className="text-center text-base font-bold" style={{ color: '#a78f79' }}>
            CONFIRM DELETION
          </p>
          <p className="text-center text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">{warbandName}</span> and all its heroes.
          </p>
          <div className="space-y-3">
            <Input
              placeholder="Type delete"
              value={deleteValue}
              onChange={(event) => setDeleteValue(event.target.value)}
            />
            {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
          </div>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isDeleteReady || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete warband"}
            </Button>
          </div>
        </SimpleDialogContent>
      </Dialog>
    </CardBackground>
  );
}
