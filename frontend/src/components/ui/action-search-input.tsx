import * as React from "react"

import scrollBackground from "@/assets/containers/scroll.webp"

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
        "absolute left-0 right-0 top-full z-20 mt-2 origin-top overflow-hidden rounded-2xl data-[state=open]:animate-[select-waterfall-in_360ms_cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      style={{
        backgroundImage: `url(${scrollBackground})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
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
  const paddingClass = hasAction ? "pr-12" : undefined

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type="search"
        className={cn(paddingClass, inputClassName, className)}
        {...props}
      />
      {hasAction ? (
        <Button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={actionAriaLabel ?? actionLabel ?? "Create"}
          className={cn(
            "absolute right-0.5 top-0.5 flex h-[90%] aspect-square items-center justify-center p-0 hover:translate-y-0 active:translate-y-0",
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

