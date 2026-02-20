import * as React from "react"

import borderContainer from "@/assets/containers/border_container.webp"
import helpIcon from "@/assets/components/help.webp"

// utils
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/lib/use-media-query"

// other
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Tooltip } from "@components/tooltip"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const isMobile = useMediaQuery("(max-width: 960px)")
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 min-[960px]:bg-transparent",
        className
      )}
      style={{
        ...(isMobile
          ? undefined
          : {
              backgroundImage:
                "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%)",
            }),
        ...style,
      }}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  helpContent?: React.ReactNode
  helpMinWidth?: number
  helpMaxWidth?: number
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, helpContent, helpMinWidth = 320, helpMaxWidth = 520, ...props }, ref) => {
  const isMobile = useMediaQuery("(max-width: 960px)")
  return (
    <DialogPortal>
      <DialogClose asChild>
        <DialogOverlay />
      </DialogClose>
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[60] w-full max-h-[85vh] overflow-hidden overflow-x-hidden overscroll-x-none rounded-t-2xl border-t border-[#3b2f25] bg-[#0b0a08] shadow-[0_-18px_40px_rgba(6,3,2,0.65)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "min-[960px]:left-[50%] min-[960px]:top-[50%] min-[960px]:bottom-auto min-[960px]:w-[calc(100%-2rem)] min-[960px]:max-h-[90vh] min-[960px]:-translate-x-1/2 min-[960px]:-translate-y-1/2 min-[960px]:rounded-none min-[960px]:bg-transparent min-[960px]:shadow-[0_32px_50px_rgba(6,3,2,0.55)] min-[960px]:data-[state=closed]:zoom-out-95 min-[960px]:data-[state=open]:zoom-in-95 min-[960px]:data-[state=closed]:slide-out-to-left-1/2 min-[960px]:data-[state=closed]:slide-out-to-top-[48%] min-[960px]:data-[state=open]:slide-in-from-left-1/2 min-[960px]:data-[state=open]:slide-in-from-top-[48%]",
          className,
          "max-[959px]:!max-w-full"
        )}
        style={{
          ...(isMobile
            ? undefined
            : {
                backgroundImage: `url(${borderContainer})`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }),
        }}
        {...props}
      >
        <div className="relative flex max-h-[85vh] flex-col overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 text-[15px] text-foreground min-[960px]:max-h-[90vh] min-[960px]:px-8 min-[960px]:py-8">
          <div className="mb-3 flex justify-center min-[960px]:hidden">
            <span className="h-1 w-12 rounded-full bg-[#3b2f25]" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-x-none">
            {children}
          </div>
        </div>
        {helpContent ? (
          <div className="absolute left-3 top-3">
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
  )
})
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
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isMobile = useMediaQuery("(max-width: 960px)")
  return (
    <div
      className={cn(
        isMobile
          ? "flex flex-row flex-wrap justify-end gap-2 [&>*]:h-9 [&>*]:px-4 [&>*]:text-[0.6rem] [&>*]:max-w-[50%] [&>*]:whitespace-nowrap"
          : "flex flex-row justify-end gap-2",
        className
      )}
      {...props}
    />
  )
}
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
