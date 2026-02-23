import * as React from "react"

import primaryButton from "@/assets/components/primary_button.webp"
import secondaryButton from "@/assets/components/secondary_button.webp"

// utils
import { cn } from "@/lib/utils"

// other
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "button-primary inline-flex items-center justify-center gap-2 whitespace-nowrap bg-transparent font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-foreground shadow-[0_10px_24px_rgba(12,7,3,0.55)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-[1px] active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        secondary: "button-secondary",
        primaryHover: "button-primary-hover",
        secondaryHover: "button-secondary-hover",
        outline: "",
        ghost: "",
        destructive: "",
        link: "",
        rpgLong: "",
        rpgFrame: "",
        rpgMini: "",
      },
      size: {
        default: "h-9 px-5 md:h-12 md:px-7",
        sm: "h-8 px-4 text-[0.58rem] md:h-10 md:px-5 md:text-[0.6rem]",
        lg: "h-10 px-7 text-[0.68rem] md:h-14 md:px-9 md:text-[0.7rem]",
        icon: "h-9 w-9 p-0 text-[0.6rem] md:h-10 md:w-10",
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
  ({ className, variant, size, asChild = false, type, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedType = type ?? "button"
    const resolvedVariant = variant ?? "default"
    const backgroundMap: Record<string, string> = {
      default: primaryButton,
      secondary: secondaryButton,
      primaryHover: primaryButton,
      secondaryHover: secondaryButton,
    }
    const background = backgroundMap[resolvedVariant] ?? backgroundMap.default
    const mergedStyle: React.CSSProperties = {
      ["--button-bg" as string]: `url(${background})`,
      ...style,
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        type={resolvedType}
        ref={ref}
        style={mergedStyle}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
