import { cn } from "@/lib/utils";

type FieldErrorProps = {
  message?: string | null;
  /** Lets the input name this line in `aria-describedby`. */
  id?: string;
  className?: string;
};

/** A field's own error, under its input: a server refusal of that field, or a hint before Save. */
export function FieldError({ message, id, className }: FieldErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} role="alert" className={cn("mt-1 text-xs text-red-600", className)}>
      {message}
    </p>
  );
}
