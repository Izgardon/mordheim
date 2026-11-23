import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { lineName, linesFor, listsFor, priceLabel } from "../template-view";
import type { TemplateLine, TemplateList } from "../types/template-types";

/** Who may take it (the server's words), the most a warband may have and the book's note: "Gaolers only · max 1". */
function lineNotes(line: TemplateLine) {
  return [
    line.who_text,
    line.warband_max ? `max ${line.warband_max} per warband` : "",
    line.note,
  ].filter(Boolean);
}

/** One list under its name, which shows and hides it (William, 23 Nov 2026). */
function ListSection({
  list,
  variant,
  startOpen,
}: {
  list: TemplateList;
  variant: string;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-9 w-full items-center justify-between gap-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-faint hover:text-text2"
        >
          {list.name}
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>
      </h3>
      {open ? (
        <>
          {list.note ? <p className="m-0 text-xs text-text2">{list.note}</p> : null}
          <ul aria-label={list.name} className="m-0 flex list-none flex-col p-0">
            {linesFor(list.lines, variant).map((line) => {
              const notes = lineNotes(line);
              return (
                <li
                  key={line.id}
                  className="flex flex-col border-t border-line py-1.5 first:border-t-0"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-ink">{lineName(line)}</span>
                    <span className="shrink-0 font-mono text-[13px] text-ink">
                      {priceLabel(line)}
                    </span>
                  </span>
                  {notes.length ? (
                    <span className="text-xs text-muted-foreground">{notes.join(" · ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/**
 * The template's equipment lists: each with its note and its lines in the variant at their list
 * prices, shown on the web and hidden on a phone until opened.
 */
export default function TemplateLists({
  lists,
  variant,
  isMobile,
}: {
  lists: TemplateList[];
  variant: string;
  isMobile: boolean;
}) {
  return (
    <>
      {listsFor(lists, variant).map((list) => (
        <ListSection key={list.id} list={list} variant={variant} startOpen={!isMobile} />
      ))}
    </>
  );
}
