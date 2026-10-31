import * as React from "react";

import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLElement> & {
  /** The element to render ("section", "article"...); a div by default. */
  as?: React.ElementType;
  /** An open card (a unit shown in full) takes the accent line as its border. */
  expanded?: boolean;
};

/** A card: surface fill, a border, square corners. */
const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ as: Component = "div", className, expanded = false, ...props }, ref) => (
    <Component
      ref={ref}
      data-expanded={expanded || undefined}
      className={cn(
        "relative border bg-surface text-ink",
        expanded ? "border-accent-line" : "border-border",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
