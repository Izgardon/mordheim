import * as React from "react";

import { cn } from "@/lib/utils";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Buttons (design E): primary is the accent fill, secondary a strong outline on the surface,
 * ghost has no box until hovered, danger is a lossy action in danger colours. For a button that
 * holds only an icon use `IconButton`, which requires a label.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-bold leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-on-accent hover:border-accent-hi hover:bg-accent-hi",
        secondary: "border-strong bg-surface text-ink hover:bg-raised",
        ghost: "border-transparent bg-transparent text-text2 hover:bg-raised hover:text-head",
        danger: "border-danger-line bg-transparent text-danger hover:bg-danger-bg",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-11 w-11 p-0 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-variant={variant ?? "primary"}
        type={asChild ? undefined : (type ?? "button")}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
