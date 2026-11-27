import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsDisclosureProps = {
  title: string;
  /** One line saying what the closed section holds now ("Up to 1c · 9 of 21 ticked"). */
  summary: ReactNode;
  /** Warnings the closed section would otherwise hide: a departure from the preset, a gap. */
  warnings?: string[];
  children: ReactNode;
};

/**
 * A settings card's row that folds its controls away (William, 27 Nov 2026: "more dropdowns/data
 * concealing till revealed"): its title and what it holds now on one button, closed at first. The
 * controls stay mounted while it is closed, so a draft survives folding it away; the warnings
 * stay outside the fold, because a departure from the preset has to be read.
 */
export default function SettingsDisclosure({
  title,
  summary,
  warnings = [],
  children,
}: SettingsDisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  return (
    <div className="flex flex-col border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-settings-disclosure=""
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center gap-3 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={titleId} className="text-[15px] font-bold text-head">
            {title}
          </span>
          <span className="text-[13px] text-text2">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {!open && warnings.length ? (
        <div className="flex flex-col gap-0.5 pb-3">
          {warnings.map((warning) => (
            <span key={warning} className="text-[13px] text-accent-text">
              {warning}
            </span>
          ))}
        </div>
      ) : null}
      <div
        id={panelId}
        role="group"
        aria-labelledby={titleId}
        hidden={!open}
        className={
          open
            ? "mb-4 flex flex-col gap-4 border-l-2 border-accent-line pb-1 pl-4 max-[960px]:pl-3"
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

/** The departure warnings, in the server's words, for the fields a section holds. */
export function departuresFor(departures: Map<string, string>, fields: string[]) {
  return fields.flatMap((field) => {
    const message = departures.get(field);
    return message ? [message] : [];
  });
}
