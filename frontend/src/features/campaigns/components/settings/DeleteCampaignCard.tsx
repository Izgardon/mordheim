import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
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
          <DialogContent className="max-w-[750px]">
              <DialogHeader>
                <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>CONFIRM CLOSURE</DialogTitle>
              </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Type delete"
                value={deleteValue}
                onChange={(event) => onDeleteValueChange(event.target.value)}
              />
              {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={!isDeleteReady || isDeleting}
              >
                {isDeleting ? "Deleting..." : "Erase campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </CardBackground>
  );
}

