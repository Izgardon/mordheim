import * as React from "react";
import { Plus } from "lucide-react";

import { Input } from "@components/input";
import { cn } from "@/lib/utils";

type ActionSearchInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  onAction?: () => void;
  actionLabel?: string;
  actionAriaLabel?: string;
  actionDisabled?: boolean;
  containerClassName?: string;
  inputClassName?: string;
  actionClassName?: string;
  children?: React.ReactNode;
};

type ActionSearchDropdownProps = {
  open: boolean;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
};

/** The suggestions under an ActionSearchInput; a click outside both closes it. */
export function ActionSearchDropdown({
  open,
  onClose,
  className,
  children,
}: ActionSearchDropdownProps) {
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || !onClose) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const parent = dropdownRef.current.parentElement;
        if (parent && parent.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden border border-strong bg-surface",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A search box with an optional + button beside it (create what was typed). */
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
  const hasAction = Boolean(onAction);

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        type="search"
        className={cn(hasAction ? "pr-14" : undefined, inputClassName, className)}
        {...props}
      />
      {hasAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={actionAriaLabel ?? actionLabel ?? "Create"}
          className={cn(
            "absolute right-0 top-0 flex aspect-square h-full items-center justify-center border border-strong bg-raised text-text2 hover:text-head disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4",
            actionClassName
          )}
        >
          <Plus aria-hidden="true" />
          {actionLabel ? <span className="sr-only">{actionLabel}</span> : null}
        </button>
      ) : null}
      {children}
    </div>
  );
}
