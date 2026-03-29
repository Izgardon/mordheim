import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[#3a2c20] bg-[#14110c]/80 font-display text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#e9dcc2] shadow-[0_8px_16px_rgba(6,4,2,0.28)] transition duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e7549] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[#6e5a3b] bg-[#2a2117] text-white shadow-[0_10px_18px_rgba(10,6,3,0.35)]",
        secondary: "bg-[#14110c]/80 text-[#e9dcc2]",
        primaryHover: "bg-[#14110c]/80 text-[#f2e7cf]",
        secondaryHover: "bg-[#110d09]/85 text-[#dfd0b1]",
        outline: "border-[#6b5436] bg-black/20 text-[#f1e5cd] shadow-none hover:bg-[#20170f]/80",
        ghost: "border-transparent bg-transparent text-[#eadfc8] shadow-none hover:bg-[#20170f]/70",
        destructive: "border-[#7c3328] bg-[#40150f]/90 text-[#ffd6cb] shadow-[0_8px_16px_rgba(34,6,4,0.35)] hover:brightness-105",
        link: "h-auto border-transparent bg-transparent px-0 py-0 font-sans text-xs normal-case tracking-normal text-[#f1e5cd] shadow-none underline-offset-4 hover:underline",
        rpgLong: "border-[#6e5a3b] bg-[#2a2117] text-white shadow-[0_10px_18px_rgba(10,6,3,0.35)]",
        rpgFrame: "border-[#5a4734] bg-[#17120d] text-[#efe2c7]",
        rpgMini: "border-[#6b5436] bg-[#1d160f] text-[#f2e7cf] shadow-none",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 py-1.5 text-[0.58rem] tracking-[0.2em]",
        lg: "h-10 px-5 py-2.5 text-[0.68rem]",
        icon: "h-9 w-9 p-0",
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
  opaque?: boolean
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, opaque, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const resolvedType = type ?? "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), opaque && "bg-[#14110c]")}
        type={resolvedType}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
