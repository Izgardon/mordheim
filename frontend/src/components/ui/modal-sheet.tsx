import type { ReactNode } from "react";
import { X } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type ModalSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kicker?: ReactNode;
  title: ReactNode;
  description?: string;
  /** The confirm and cancel row: the modal's footer, or the sheet's fixed footer on a phone. */
  footer?: ReactNode;
  children: ReactNode;
  /** The modal's width on the web (a Tailwind max-width class). */
  className?: string;
  /** A close × in the web modal's header, as the drawers have (the phone's sheet has one). */
  closeButton?: boolean;
};

/** A modal on the web and a bottom sheet on a phone (design E): camp's sell, recruit and ready. */
export function ModalSheet({
  open,
  onOpenChange,
  kicker,
  title,
  description,
  footer,
  children,
  className,
  closeButton = false,
}: ModalSheetProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        kicker={kicker}
        title={title}
        description={description}
        footer={footer}
      >
        {children}
      </BottomSheet>
    );
  }
  const header = (
    <DialogHeader>
      {kicker ? <DialogKicker>{kicker}</DialogKicker> : null}
      <DialogTitle>{title}</DialogTitle>
      {description ? (
        <DialogDescription className="sr-only">{description}</DialogDescription>
      ) : null}
    </DialogHeader>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-[560px]", className)}>
        {closeButton ? (
          <div className="flex items-start justify-between gap-3">
            {header}
            <DialogClose asChild>
              <IconButton aria-label="Close" className="shrink-0">
                <X aria-hidden="true" />
              </IconButton>
            </DialogClose>
          </div>
        ) : (
          header
        )}
        <div className="flex flex-col gap-4">{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
