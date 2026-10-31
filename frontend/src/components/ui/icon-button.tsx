import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IconButtonProps = Omit<ButtonProps, "size" | "variant" | "aria-label"> & {
  /** Required: the icon is all a sighted user sees, so this is all a screen reader gets. */
  "aria-label": string;
  /** "outline" (the default) has a thin border; "plain" has none, for a dense bar. */
  look?: "outline" | "plain";
};

/** A 44 px square button holding only an icon (close, dice, chat, more actions). */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ look = "outline", className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn(look === "outline" && "border-border", className)}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
