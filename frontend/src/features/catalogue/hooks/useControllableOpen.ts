import { useState } from "react";

type UseControllableOpenOptions = {
  /** The caller's open state, when it holds one. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** A dialog's open state: the caller's when it passes `open`, the dialog's own otherwise. */
export function useControllableOpen({ open: openProp, onOpenChange }: UseControllableOpenOptions) {
  const [ownOpen, setOwnOpen] = useState(false);
  return {
    open: openProp ?? ownOpen,
    setOpen: (next: boolean) => {
      if (openProp === undefined) {
        setOwnOpen(next);
      }
      onOpenChange?.(next);
    },
  };
}

export type ControllableOpen = ReturnType<typeof useControllableOpen>;
