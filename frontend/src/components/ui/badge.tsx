import * as React from "react"

// utils
import { cn } from "@/lib/utils"

// other
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "rpg-frame-thin inline-flex items-center rounded-full border border-transparent px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-foreground shadow-[0_8px_18px_rgba(12,7,3,0.35)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        secondary: "bg-transparent text-muted-foreground",
        destructive: "bg-transparent text-[#f3cfb1]",
        outline: "bg-transparent text-foreground shadow-none",
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


