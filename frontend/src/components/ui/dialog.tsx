import * as React from "react"

import dialogWithHeader from "@/assets/containers/dialog_with_header.png"

// utils
import { cn } from "@/lib/utils"

// other
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ExitIcon } from "@/components/ui/exit-icon"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      " fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const flattenDialogChildren = (children: React.ReactNode) =>
  React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return React.Children.toArray(child.props.children)
    }
    return [child]
  })

const matchesDialogType = (
  child: React.ReactNode,
  component: React.ComponentType<any>,
  displayName: string
): child is React.ReactElement => {
  if (!React.isValidElement(child)) {
    return false
  }
  return (
    child.type === component ||
    (child.type as { displayName?: string }).displayName === displayName
  )
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-none bg-transparent duration-200 sm:w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}
    >
      <div
        className="relative flex max-h-[90vh] flex-col gap-6 overflow-visible text-foreground"
        style={{
          backgroundImage: `url(${dialogWithHeader})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          boxShadow: "0 32px 50px rgba(6, 3, 2, 0.55)",
          ["--dialog-title-top" as string]: "max(15px, 4%)",
          minHeight: "min(600px, 90vh)",
        }}
      >
        {(() => {
          const flatChildren = flattenDialogChildren(children)
          const headerItems = flatChildren.filter((child) =>
            matchesDialogType(child, DialogHeader, "DialogHeader")
          )
          const footerItems = flatChildren.filter((child) =>
            matchesDialogType(child, DialogFooter, "DialogFooter")
          )
          const bodyItems = flatChildren.filter(
            (child) =>
              !matchesDialogType(child, DialogHeader, "DialogHeader") &&
              !matchesDialogType(child, DialogFooter, "DialogFooter")
          )
          return (
            <>
              <div className="px-10 pt-14">{headerItems}</div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-10 py-6">
                {bodyItems}
              </div>
              <div className="mt-auto px-10 pb-8">{footerItems}</div>
            </>
          )
        })()}
      </div>
      <DialogPrimitive.Close
        type="button"
        className="absolute right-1 top-[6%]"
      >
        <ExitIcon />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName
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
      "absolute left-1/2 top-[var(--dialog-title-top)] -translate-x-1/2 font-display text-2xl leading-none tracking-[0.02em]",
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
