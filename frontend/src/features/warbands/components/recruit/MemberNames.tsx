import { useId, useRef, useState } from "react";
import { X } from "lucide-react";

import { FieldError } from "@/components/ui/field-error";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NUMBER_INPUT_HEIGHT } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

import { NAME_NEEDED } from "./RecruitNameField";

/**
 * Each new member's name, one per model (William, 28 Nov 2026: "when recruiting henchmen from a
 * list i should be able to set their names in that initial form"). `count` is how many the form
 * recruits; a name typed stays with its place, so a model taken off and put back keeps it. A
 * name never typed reads `prefill`'s, where the form has one (a creature's "Warhound 1"), and
 * blank otherwise. `ready()` answers whether Recruit may send, and otherwise shows "Name is
 * needed." under each blank one and puts the cursor in the first (or not, when the form's own
 * name took it).
 */
export function useMemberNames(count: number, prefill?: (index: number) => string) {
  const [typed, setTyped] = useState<(string | null)[]>([]);
  const [tried, setTried] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const names = Array.from({ length: count }, (_, i) => typed[i] ?? prefill?.(i) ?? "");
  const blank = names.map((name) => !name.trim());
  return {
    names,
    refs,
    errors: blank.map((empty) => (tried && empty ? NAME_NEEDED : null)),
    set: (index: number, value: string) =>
      setTyped((list) => {
        const next = Array.from({ length: Math.max(list.length, index + 1) }, (_, i) =>
          i < list.length ? list[i] : null
        );
        next[index] = value;
        return next;
      }),
    /** Takes one out of the middle: the names after it move up a place. */
    removeAt: (index: number) => setTyped((list) => list.filter((_, i) => i !== index)),
    ready: (focus = true) => {
      setTried(true);
      const first = blank.indexOf(true);
      if (first >= 0 && focus) refs.current[first]?.focus();
      return first < 0;
    },
  };
}

export type MemberNamesField = ReturnType<typeof useMemberNames>;

/**
 * The members' names under the group's name and models: a compact list, "Model 1", "Model 2",
 * two to a row on the web, each as tall as the Models stepper and saying "Name is needed." under a
 * blank one. With `onRemove`, each has its own Remove (camp's recruits).
 */
export default function MemberNames({
  field,
  label = "Model",
  onRemove,
}: {
  field: MemberNamesField;
  /** Each field's label before its number: "Model 1", or camp's "Recruit 1". */
  label?: string;
  onRemove?: (index: number) => void;
}) {
  const id = useId();
  if (!field.names.length) return null;
  return (
    <ol
      aria-label="Names"
      className="m-0 grid list-none gap-x-3 gap-y-1.5 p-0 min-[720px]:grid-cols-2"
    >
      {field.names.map((name, index) => {
        const inputId = `${id}-${index}`;
        const error = field.errors[index];
        return (
          <li
            key={index}
            className={cn(
              "grid items-center gap-x-2",
              onRemove
                ? "grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                : "grid-cols-[4.5rem_minmax(0,1fr)]"
            )}
          >
            <label htmlFor={inputId} className="text-xs font-bold text-muted-foreground">
              {label} {index + 1}
            </label>
            <Input
              ref={(input) => {
                field.refs.current[index] = input;
              }}
              id={inputId}
              inputSize="sm"
              className={NUMBER_INPUT_HEIGHT.sm}
              value={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              onChange={(event) => field.set(index, event.target.value)}
            />
            {onRemove ? (
              <IconButton
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                className="h-9 w-9"
                onClick={() => onRemove(index)}
              >
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
            <FieldError
              id={`${inputId}-error`}
              message={error}
              className="col-start-2 col-end-[-1] mt-0.5"
            />
          </li>
        );
      })}
    </ol>
  );
}
