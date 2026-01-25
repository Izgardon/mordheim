import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] shadow-[0_10px_20px_rgba(5,20,24,0.25)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/85",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline: "border-border/70 text-foreground shadow-none",
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


