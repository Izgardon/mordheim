import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-semibold text-sm leading-none text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e7549] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-primary",
        primary: "btn-primary",
        secondary: "btn-secondary",
        subtle: "btn-subtle",
        outline: "btn-outline",
        ghost: "btn-ghost",
        destructive: "btn-destructive",
        nav: "btn-nav rounded-md px-3 shadow-none leading-tight",
        toolbar: "btn-toolbar",
        icon: "btn-icon",
        link: "h-auto border-transparent bg-transparent px-0 py-0 font-sans text-xs normal-case tracking-normal text-[color:var(--color-text-soft)] shadow-none underline-offset-4 hover:text-[color:var(--color-text)] hover:underline",
        primaryHover: "btn-secondary",
        secondaryHover: "btn-subtle",
        rpgLong: "btn-primary",
        rpgFrame: "btn-secondary",
        rpgMini: "btn-subtle shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 py-1.5 text-xs",
        lg: "h-11 px-5 py-2.5",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  opaque?: boolean
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, opaque, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedType = type ?? "button"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          opaque && "bg-[#1b140f]"
        )}
        type={resolvedType}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
