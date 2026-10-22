import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BestiaryFormDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (event: FormEvent) => void;
  /** The line under the fields. */
  error: string;
  isSaving: boolean;
  /** Create waits for a name. */
  canSubmit: boolean;
  children: ReactNode;
};

/**
 * The bestiary pages' form dialog (Add Bestiary Entry, Add Hired Sword): a scrolling form,
 * the line under it, Cancel and Create. Cancel only closes; what was entered stays for next time.
 */
export default function BestiaryFormDialogShell({
  open,
  onOpenChange,
  title,
  onSubmit,
  error,
  isSaving,
  canSubmit,
  children,
}: BestiaryFormDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {children}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
