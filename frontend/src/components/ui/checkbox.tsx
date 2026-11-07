import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  checked?: boolean;
};

/**
 * The square tick box on the tokens (the item form's, William: "a cool checkbox"): accent fill
 * when ticked, a focus ring for the keyboard. Every form's tick box is this one.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, disabled, ...props }, ref) => {
    return (
      <span
        className={cn(
          "relative inline-flex h-5 w-5 shrink-0 items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex h-full w-full items-center justify-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
            checked
              ? "border-primary bg-primary text-on-accent"
              : "border-strong bg-page text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";

/** As tall as the input it sits beside: a default input, or a small one. */
const INLINE = { default: "h-9 md:h-11", sm: "h-8 md:h-9" } as const;

type CheckboxFieldProps = CheckboxProps & {
  /** The words beside the box. */
  children: React.ReactNode;
  /**
   * In a row of fields (William: "how it sits inline with an input"): as tall as an input, its
   * box and words centred on the input's line, at the row's foot under the other fields' labels.
   */
  inline?: boolean | keyof typeof INLINE;
  /** The label's own classes (its gap, text size or a row's border). */
  labelClassName?: string;
};

/** A tick box and its words as one label: clicking either ticks it. */
const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ children, inline = false, labelClassName, ...box }, ref) => (
    <label
      className={cn(
        "flex w-fit items-center gap-2 text-sm text-ink",
        box.disabled ? "cursor-not-allowed" : "cursor-pointer",
        inline && cn("self-end", INLINE[inline === true ? "default" : inline]),
        labelClassName
      )}
    >
      <Checkbox ref={ref} {...box} />
      <span className="min-w-0">{children}</span>
    </label>
  )
);
CheckboxField.displayName = "CheckboxField";

export { Checkbox, CheckboxField };
