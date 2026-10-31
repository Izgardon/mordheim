import * as React from "react";

// utils
import { cn } from "@/lib/utils";

type InputSize = "sm" | "default" | "lg";

type InputProps = React.ComponentProps<"input"> & {
  inputSize?: InputSize;
};

const inputSizeClasses: Record<InputSize, string> = {
  sm: "h-8 px-3 py-1.5 text-xs md:h-9",
  default: "h-9 px-4 py-2 text-sm md:h-11",
  lg: "h-10 px-4 py-2 text-base md:h-12",
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, inputSize = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full border border-strong bg-page font-medium text-ink shadow-none transition-colors file:bg-transparent placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          inputSizeClasses[inputSize],
          className
        )}
        ref={ref}
        style={style}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
export { Input };
