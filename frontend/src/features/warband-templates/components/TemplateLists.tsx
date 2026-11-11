import { DetailSection } from "@/features/reference/ReferenceDetail";

import { lineName, linesFor, listsFor, priceLabel } from "../template-view";
import type { TemplateLine, WarbandTemplate } from "../types/template-types";

/** Who may take it (the server's words), the most a warband may have and the book's note: "Gaolers only · max 1". */
function lineNotes(line: TemplateLine) {
  return [
    line.who_text,
    line.warband_max ? `max ${line.warband_max} per warband` : "",
    line.note,
  ].filter(Boolean);
}

/** The template's equipment lists: each with its note and its lines in the variant at their list prices. */
export default function TemplateLists({
  template,
  variant,
}: {
  template: WarbandTemplate;
  variant: string;
}) {
  return (
    <>
      {listsFor(template.lists, variant).map((list) => (
        <DetailSection key={list.id} title={list.name}>
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
                    <span className="text-ink">{lineName(line)}</span>
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
        </DetailSection>
      ))}
    </>
  );
}
