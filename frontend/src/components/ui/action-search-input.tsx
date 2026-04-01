import * as React from "react"

// components
import { Button } from "@components/button"
import { Input } from "@components/input"

// utils
import { cn } from "@/lib/utils"

// icons
import { Plus } from "lucide-react"

type ActionSearchInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  onAction?: () => void
  actionLabel?: string
  actionAriaLabel?: string
  actionDisabled?: boolean
  containerClassName?: string
  inputClassName?: string
  actionClassName?: string
  children?: React.ReactNode
}

type ActionSearchDropdownProps = {
  open: boolean
  onClose?: () => void
  className?: string
  children: React.ReactNode
}

export function ActionSearchDropdown({
  open,
  onClose,
  className,
  children,
}: ActionSearchDropdownProps) {
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || !onClose) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Check if click is inside the parent container (ActionSearchInput)
        const parent = dropdownRef.current.parentElement
        if (parent && parent.contains(event.target as Node)) {
          return
        }
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      ref={dropdownRef}
      data-state="open"
      className={cn(
        "absolute left-0 right-0 top-full z-20 mt-2 origin-top overflow-hidden rounded-xl border border-[#4a3829]/55 bg-[#120e0a] shadow-[0_18px_32px_rgba(6,4,2,0.32)] data-[state=open]:animate-[select-waterfall-in_360ms_cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ActionSearchInput({
  onAction,
  actionLabel,
  actionAriaLabel,
  actionDisabled,
  containerClassName,
  inputClassName,
  actionClassName,
  className,
  children,
  ...props
}: ActionSearchInputProps) {
  const hasAction = Boolean(onAction)
  const paddingClass = hasAction ? "pr-14" : undefined

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type="search"
        className={cn(
          paddingClass,
          inputClassName,
          "!border-border/60 !bg-background/70 text-foreground placeholder:text-muted-foreground focus-visible:!ring-[#9a7a45] min-[960px]:!border-[#4a3829] min-[960px]:!bg-black",
          className
        )}
        {...props}
      />
      {hasAction ? (
        <Button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={actionAriaLabel ?? actionLabel ?? "Create"}
          className={cn(
            "absolute right-0 top-0 flex h-full min-w-0 aspect-square items-center justify-center rounded-sm border border-border/60 bg-background/70 p-0 text-[color:var(--color-icon-soft)] shadow-none hover:bg-background/80 hover:translate-y-0 active:translate-y-0 min-[960px]:border-[#4a3829] min-[960px]:bg-black min-[960px]:hover:bg-[#120e0a] [&_svg]:h-4 [&_svg]:w-4",
            actionClassName
          )}
        >
          <Plus aria-hidden="true" />
          {actionLabel ? <span className="sr-only">{actionLabel}</span> : null}
        </Button>
      ) : null}
      {children}
    </div>
  )
}

