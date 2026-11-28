import { useId, useRef, useState } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";

/** The server's refusal of a recruit with no name (units/create_serializer.py), said before it is sent. */
export const NAME_NEEDED = "Name is needed.";

/**
 * A recruit's name, which he must have (William, 26 Nov 2026: "Block it, needs a name"): `ready()`
 * answers whether Recruit may send, and otherwise shows "Name is needed." under the field and
 * puts the cursor in it. Typing a name clears the line.
 */
export function useRecruitName(initial = "") {
  const [name, setName] = useState(initial);
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const blank = !name.trim();
  const ready = () => {
    setTried(true);
    if (blank) ref.current?.focus();
    return !blank;
  };
  return { name, setName, ready, ref, error: tried && blank ? NAME_NEEDED : null };
}

export type RecruitName = ReturnType<typeof useRecruitName>;

/** The name's label, input and its "Name is needed." line, for every form that recruits. */
export default function RecruitNameField({
  field,
  label = "Name",
  className,
  labelClassName,
  inputSize,
  inputClassName,
  autoFocus,
}: {
  field: RecruitName;
  label?: string;
  className?: string;
  /** The label's own line, where a form lines its labels up. */
  labelClassName?: string;
  inputSize?: "sm" | "default";
  /** The input's own classes: a height to match the field beside it. */
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const id = `${useId()}-name`;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <Input
        ref={field.ref}
        id={id}
        inputSize={inputSize}
        className={inputClassName}
        autoFocus={autoFocus}
        value={field.name}
        aria-invalid={field.error ? true : undefined}
        aria-describedby={field.error ? `${id}-error` : undefined}
        onChange={(event) => field.setName(event.target.value)}
      />
      <FieldError id={`${id}-error`} message={field.error} className="mt-0 font-normal" />
    </div>
  );
}
