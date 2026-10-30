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

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("font-display text-xl font-semibold leading-tight text-head", className)}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);

export { Card, CardHeader, CardFooter, CardTitle, CardContent };
