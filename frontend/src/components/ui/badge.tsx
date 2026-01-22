import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border-2 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] shadow-[2px_2px_0_rgba(24,16,8,0.25)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-border text-foreground shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
export { Badge, badgeVariants }


