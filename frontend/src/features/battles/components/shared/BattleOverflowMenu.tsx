import { useState } from "react";
import { EllipsisVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";
import { cn } from "@/lib/utils";

export type BattleOverflowAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Lossy or irreversible: styled destructive, so it never reads as the normal path. */
  destructive?: boolean;
};

type BattleOverflowMenuProps = {
  actions: BattleOverflowAction[];
  /** "icon" for the phone's top bar, "button" for the desktop subnav. */
  appearance?: "icon" | "button";
};

/**
 * The battle pages' "More actions" menu: actions that shouldn't sit next to the normal path
 * (Skip postbattle, Cancel battle). It opens as a sheet, so it works by touch and keyboard.
 */
export default function BattleOverflowMenu({
  actions,
  appearance = "icon",
}: BattleOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (actions.length === 0) {
    return null;
  }

  const trigger =
    appearance === "icon" ? (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="icon-button flex h-11 w-11 items-center justify-center border-none bg-transparent p-0"
        aria-label="More actions"
        aria-haspopup="dialog"
      >
        <EllipsisVertical className="theme-heading-soft h-5 w-5" aria-hidden="true" />
      </button>
    ) : (
      // Icon-only beside the subnav's other small buttons, so the page title keeps its room.
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-8 px-0"
        onClick={() => setIsOpen(true)}
        aria-label="More actions"
        aria-haspopup="dialog"
        title="More actions"
      >
        <EllipsisVertical aria-hidden="true" />
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={cn("max-w-sm", HELPER_DIALOG_CONTENT_CLASS)}>
          <DialogHeader>
            <DialogTitle>More actions</DialogTitle>
            <DialogDescription className="sr-only">
              Battle actions that are kept away from the main buttons.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant={action.destructive ? "destructive" : "secondary"}
                className="h-11 w-full"
                disabled={action.disabled}
                onClick={() => {
                  setIsOpen(false);
                  action.onSelect();
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
