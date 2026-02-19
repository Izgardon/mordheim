import { useState } from "react";
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
  DialogContent,
} from "@components/dialog";
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

  const isMobile = useMediaQuery("(max-width: 960px)")

  return (
    <CardBackground disableBackground={isMobile} className={isMobile ? "space-y-4 p-3" : "space-y-4 p-6"}>
      <h3 className="text-lg font-semibold text-destructive">Delete warband</h3>
      <p className="text-sm text-muted-foreground">
        Permanently delete <span className="font-semibold text-foreground">{warbandName}</span> and all its units.
      </p>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="destructive">Delete warband</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[400px]">
          <DialogTitle className="sr-only">Confirm deletion</DialogTitle>
          <p className="text-center text-base font-bold" style={{ color: '#a78f79' }}>
            CONFIRM DELETION
          </p>
          <p className="text-center text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">{warbandName}</span> and all its units.
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
        </DialogContent>
      </Dialog>
    </CardBackground>
  );
}
