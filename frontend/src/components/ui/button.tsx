import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border font-semibold text-sm text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e7549] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[#5c4834] bg-[#241b13] text-[#f6efe2] shadow-[0_10px_22px_rgba(6,4,2,0.24)] hover:bg-[#2d2218]",
        primary: "border-[#6d573e] bg-[#2f2419] text-[#fffaf1] shadow-[0_10px_22px_rgba(6,4,2,0.24)] hover:bg-[#392b1e]",
        secondary: "border-[#4c3a2a] bg-[#18120d] text-[#e7d8c0] hover:bg-[#221912]",
        subtle: "border-[#3a2c20] bg-[#120e0a] text-[#d9c8ac] hover:bg-[#19120d]",
        outline: "border-[#5c4834] bg-transparent text-[#f1e5cd] hover:bg-[#20170f]/70",
        ghost: "border-transparent bg-transparent text-[#eadfc8] hover:bg-[#20170f]/70",
        destructive: "border-[#7c3328] bg-[#40150f] text-[#ffd6cb] hover:bg-[#4b1912]",
        nav: "justify-start rounded-md border-transparent bg-transparent px-3 text-[#d9c8ac] shadow-none hover:border-[#3a2c20] hover:bg-[#18120d] hover:text-[#f4ead9] data-[active=true]:border-[#4c3a2a] data-[active=true]:bg-[#18120d] data-[active=true]:text-[#fff7e8]",
        toolbar: "border-[#433226] bg-[#14100c] text-[#e7d8c0] hover:bg-[#1d160f] data-[active=true]:border-[#6d573e] data-[active=true]:bg-[#22180f] data-[active=true]:text-[#fff7e8]",
        icon: "border-[#433226] bg-[#14100c] text-[#d9c8ac] hover:bg-[#1d160f] hover:text-[#f5ead9] data-[active=true]:border-[#6d573e] data-[active=true]:bg-[#22180f] data-[active=true]:text-[#fff7e8]",
        link: "h-auto border-transparent bg-transparent px-0 py-0 font-sans text-xs normal-case tracking-normal text-[#f1e5cd] shadow-none underline-offset-4 hover:underline",
        primaryHover: "border-[#4c3a2a] bg-[#18120d] text-[#f2e7cf] hover:bg-[#241b13]",
        secondaryHover: "border-[#433226] bg-[#14100c] text-[#dfd0b1] hover:bg-[#1a130d]",
        rpgLong: "border-[#6d573e] bg-[#2f2419] text-[#fffaf1]",
        rpgFrame: "border-[#5a4734] bg-[#17120d] text-[#efe2c7]",
        rpgMini: "border-[#6b5436] bg-[#1d160f] text-[#f2e7cf] shadow-none",
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
