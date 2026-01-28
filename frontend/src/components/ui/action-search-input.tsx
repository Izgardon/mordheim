import * as React from "react"

// components
import { Button, type ButtonProps } from "@components/button"
import { Input } from "@components/input"

// utils
import { cn } from "@/lib/utils"

// icons
import { Plus } from "lucide-react"

type ActionSearchInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  onAction?: () => void
  actionLabel?: string
  actionIcon?: React.ReactNode
  actionAriaLabel?: string
  actionDisabled?: boolean
  containerClassName?: string
  inputClassName?: string
  actionClassName?: string
  actionVariant?: ButtonProps["variant"]
  actionSize?: ButtonProps["size"]
}

export function ActionSearchInput({
  onAction,
  actionLabel,
  actionIcon,
  actionAriaLabel,
  actionDisabled,
  containerClassName,
  inputClassName,
  actionClassName,
  actionVariant = "rpgMini",
  actionSize = "sm",
  className,
  ...props
}: ActionSearchInputProps) {
  const hasAction = Boolean(onAction)
  const paddingClass = hasAction ? (actionLabel ? "pr-32" : "pr-16") : undefined

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
          variant={actionVariant}
          size={actionSize}
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={actionAriaLabel ?? actionLabel ?? "Create"}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 hover:-translate-y-1/2 active:-translate-y-1/2",
            actionClassName
          )}
        >
          {actionIcon ?? <Plus />}
          {actionLabel ? <span>{actionLabel}</span> : null}
        </Button>
      ) : null}
    </div>
  )
}

