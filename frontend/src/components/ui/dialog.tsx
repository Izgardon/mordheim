import * as React from "react"

import borderContainer from "@/assets/containers/border_container.webp"
import helpIcon from "@/assets/components/help.webp"

// utils
import { cn } from "@/lib/utils"

// other
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ExitIcon } from "@/components/ui/exit-icon"
import { Tooltip } from "@components/tooltip"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      " fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{
      backgroundImage:
        "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%)",
      ...style,
    }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  helpContent?: React.ReactNode
  helpMinWidth?: number
  helpMaxWidth?: number
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, helpContent, helpMinWidth = 320, helpMaxWidth = 520, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-none bg-transparent duration-200 sm:w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      style={{
        backgroundImage: `url(${borderContainer})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        boxShadow: "0 32px 50px rgba(6, 3, 2, 0.55)",
      }}
      {...props}
    >
      <div className="relative flex max-h-[90vh] flex-col px-8 py-8 text-[15px] text-foreground">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          {children}
        </div>
      </div>
      <DialogPrimitive.Close
        type="button"
        className="icon-button absolute right-2 top-2 transition-[filter] hover:brightness-125"
      >
        <ExitIcon />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
      {helpContent ? (
        <div className="absolute left-2 top-2">
          <Tooltip
            trigger={
              <button
                type="button"
                className="icon-button relative h-8 w-8 transition-[filter] hover:brightness-125"
                aria-label="Help"
              >
                <img src={helpIcon} alt="" className="h-8 w-8" />
              </button>
            }
            content={helpContent}
            minWidth={helpMinWidth}
            maxWidth={helpMaxWidth}
            className="inline-flex"
          />
        </div>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col items-center gap-2 space-y-0 overflow-visible text-center",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "title-glow font-display text-2xl leading-none tracking-[0.02em]",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("hidden", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
