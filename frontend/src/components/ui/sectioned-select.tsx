import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SectionOption = { value: string; label: ReactNode; disabled?: boolean };

/** A heading ("Heroes") and the options under it; "" for options that need none ("Nobody"). */
export type SelectSection = { label: string; options: SectionOption[] };

type SectionedSelectProps = {
  sections: SelectSection[];
  /** "" shows the placeholder: an action dropdown ("Give to…") stays on it after each pick. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  /** The trigger's size and width. */
  className?: string;
  /** The open list's width, when it should be wider than a small trigger. */
  contentClassName?: string;
};

/**
 * A plain dropdown for a short list (no search) whose options sit under small headings (Heroes,
 * Henchmen, Hired swords); a section with no options has no heading.
 */
export function SectionedSelect({
  sections,
  value,
  onValueChange,
  placeholder,
  className,
  contentClassName,
  ...trigger
}: SectionedSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={trigger.disabled}>
      <SelectTrigger id={trigger.id} aria-label={trigger["aria-label"]} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {sections
          .filter((section) => section.options.length > 0)
          .map((section, index) => (
            <SelectGroup key={`${index}-${section.label}`}>
              {section.label ? (
                <SelectLabel className="pb-1 pt-2.5">{section.label}</SelectLabel>
              ) : null}
              {section.options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  );
}

/** The trigger and list of a dropdown beside a row's buttons: the buttons' height, a wider list. */
export const ROW_SELECT = {
  className: "h-8 w-auto gap-1.5 pl-2.5 pr-2 text-xs md:h-8",
  contentClassName: "w-56 max-w-[calc(100vw-2rem)]",
};

/** Entries under their headings, in the headings' order (an empty one is dropped when shown). */
export function sectionsOf<T>(
  entries: T[],
  headings: { key: string; label: string }[],
  sectionOf: (entry: T) => string,
  option: (entry: T) => SectionOption
): SelectSection[] {
  return headings.map((heading) => ({
    label: heading.label,
    options: entries.filter((entry) => sectionOf(entry) === heading.key).map(option),
  }));
}
