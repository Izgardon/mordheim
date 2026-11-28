import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";

import { ROSTER_DIVIDED } from "../page/warband-layout";

type RosterSectionProps = {
  title: string;
  meta: string;
  /** The add button's words on the web ("Add hero"); none: the reader can't add. */
  add?: string;
  /** On a phone the add button is a plus, and this is its name ("Add henchmen group"). */
  addName?: string;
  onAdd: () => void;
  /**
   * A phone's header (William, 25 Nov 2026): the add button a plus, then a chevron that folds the
   * section's cards away. Every visit starts with every section open.
   */
  phone?: boolean;
  /** Under a hairline: every section after the first. */
  divided?: boolean;
  /** The inline recruit form, at the top of the section while it is open (a phone's bottom sheet). */
  form?: ReactNode;
  /** Beside the add button: the heroes' Make a list for a type with none. */
  extra?: ReactNode;
  children: ReactNode;
};

/** One roster section (design E): its title and count, its add button, the inline form, the cards. */
export default function RosterSection(props: RosterSectionProps) {
  const { title, divided = false, form, children } = props;
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  const open = !props.phone || expanded;

  return (
    <section aria-label={title} className={cn("flex flex-col gap-3", divided && ROSTER_DIVIDED)}>
      {props.phone ? (
        <PhoneHead {...props} expanded={expanded} listId={listId} onToggle={setExpanded} />
      ) : (
        <WebHead {...props} />
      )}
      {form}
      <div id={listId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function TitleAndMeta({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <SectionTitle>{title}</SectionTitle>
      <span className="text-[13px] text-faint">{meta}</span>
    </div>
  );
}

function WebHead({ title, meta, add, onAdd, form, extra }: RosterSectionProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <TitleAndMeta title={title} meta={meta} />
      <div className="flex flex-wrap items-baseline justify-end gap-1">
        {extra}
        {add && !form ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-9 items-center gap-1.5 border border-border px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {add}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PhoneHead({
  title,
  meta,
  add,
  addName,
  onAdd,
  extra,
  expanded,
  listId,
  onToggle,
}: RosterSectionProps & { expanded: boolean; listId: string; onToggle: (open: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <TitleAndMeta title={title} meta={meta} />
        <div className="flex shrink-0 items-center gap-1">
          {add ? (
            <IconButton aria-label={addName ?? add} onClick={onAdd} className="text-accent-text">
              <Plus aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton
            look="plain"
            aria-label={title}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => onToggle(!expanded)}
          >
            <ChevronDown
              className={cn("transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </IconButton>
        </div>
      </div>
      {extra ? <div className="flex justify-start">{extra}</div> : null}
    </div>
  );
}
