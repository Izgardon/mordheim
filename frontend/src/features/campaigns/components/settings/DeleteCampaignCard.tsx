import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
  DialogContent,
} from "@components/dialog";
import { ExitIcon } from "@components/exit-icon";
import { Input } from "@components/input";

type DeleteCampaignCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  deleteValue: string;
  onDeleteValueChange: (value: string) => void;
  isDeleteReady: boolean;
  deleteError: string;
  isDeleting: boolean;
  onDelete: () => void;
};

export default function DeleteCampaignCard({
  open,
  onOpenChange,
  onReset,
  deleteValue,
  onDeleteValueChange,
  isDeleteReady,
  deleteError,
  isDeleting,
  onDelete,
}: DeleteCampaignCardProps) {
  return (
    <CardBackground className="space-y-4 p-6">
      <h3 className="text-lg font-semibold text-destructive">Delete campaign</h3>
      <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            if (!nextOpen) {
              onReset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive">Close campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[400px]">
            <DialogTitle className="sr-only">Confirm closure</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="icon-button absolute right-1 top-1 transition-[filter] hover:brightness-125"
              aria-label="Close"
            >
              <ExitIcon className="h-6 w-6" />
            </button>
            <p className="text-center text-base font-bold" style={{ color: '#a78f79' }}>
              CONFIRM CLOSURE
            </p>
            <div className="space-y-3">
              <Input
                placeholder="Type delete"
                value={deleteValue}
                onChange={(event) => onDeleteValueChange(event.target.value)}
              />
              {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={!isDeleteReady || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Erase campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </CardBackground>
  );
}

