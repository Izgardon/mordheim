import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
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
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete campaign</CardTitle>
      </CardHeader>
      <CardContent>
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
          <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm closure</DialogTitle>
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
      </CardContent>
    </Card>
  );
}

