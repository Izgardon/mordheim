import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "rpg-button inline-flex items-center justify-center gap-2 whitespace-nowrap bg-transparent font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-foreground shadow-[0_10px_24px_rgba(12,7,3,0.55)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_6px_16px_rgba(12,7,3,0.4)] disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rpg-button--mid text-foreground",
        secondary: "rpg-button--long text-foreground",
        outline:
          "rpg-button--frame-mid text-foreground/90 hover:brightness-110 active:brightness-95",
        ghost:
          "border border-border/70 bg-transparent text-foreground/75 shadow-none hover:text-foreground hover:brightness-110",
        destructive: "rpg-button--mid text-[#f6d4b5]",
        link: "bg-transparent text-foreground underline-offset-4 hover:underline",
        rpgLong: "rpg-button--long text-foreground",
        rpgFrame: "rpg-button--frame text-foreground/90 hover:brightness-110",
        rpgMini: "rpg-button--mini text-foreground",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-10 px-5 text-[0.6rem]",
        lg: "h-14 px-9 text-[0.7rem]",
        icon: "h-10 w-10 p-0 text-[0.6rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }


