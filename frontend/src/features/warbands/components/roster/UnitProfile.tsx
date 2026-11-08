import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";

import { StatStrip, type StatKey } from "@/components/ui/stat-strip";
import { cn } from "@/lib/utils";

/** The fade over a clipped note's last line, whatever the card's fill. */
const FADE = "[mask-image:linear-gradient(to_bottom,#000_calc(100%-18px),transparent)]";

/**
 * A unit's notes beside his profile, as tall as it: longer notes are clipped under a fade and a
 * chevron, and a click shows them in full (and again folds them). On a phone it sits under the
 * profile, about as tall.
 */
export function UnitNotes({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setClipped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  // inside the card's head, whose click opens and closes the card
  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    if (clipped) setExpanded((open) => !open);
  };

  return (
    <div
      role="note"
      aria-label="Notes"
      data-expanded={expanded || undefined}
      onClick={toggle}
      className={cn(
        "relative min-w-0 cursor-auto border-y border-line",
        clipped && "cursor-pointer",
        !expanded && "h-[52px] min-[960px]:h-auto"
      )}
    >
      <p
        ref={textRef}
        className={cn(
          "m-0 whitespace-pre-wrap break-words px-2.5 pb-[7px] pt-1.5 text-[13px] leading-5 text-text2",
          !expanded && "absolute inset-0 overflow-hidden",
          clipped && "pr-9",
          clipped && !expanded && FADE
        )}
      >
        <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-faint">
          Notes
        </span>
        {text}
      </p>
      {clipped ? (
        <button
          type="button"
          aria-label="Notes"
          aria-expanded={expanded}
          onClick={toggle}
          className="absolute bottom-0.5 right-0.5 inline-flex h-7 w-7 items-center justify-center text-accent-text hover:bg-raised"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The profile under a unit's name. An open card with notes (William, 8 Nov 2026: "have them
 * displayed in detailed card view, inline with the stats line which should become half width")
 * shows them beside it on the web, each half the card, and under it on a phone; without notes
 * the profile keeps the whole width.
 */
export default function UnitProfile({
  values,
  highlighted,
  notes,
}: {
  values: Partial<Record<StatKey, string | number>>;
  highlighted?: ReadonlyArray<StatKey>;
  /** The unit's notes, shown only on an open card. */
  notes?: string;
}) {
  const text = notes?.trim() ?? "";
  if (!text) return <StatStrip values={values} highlighted={highlighted} />;
  return (
    <div className="grid gap-2 min-[960px]:grid-cols-2 min-[960px]:gap-3">
      <StatStrip values={values} highlighted={highlighted} className="self-start" />
      <UnitNotes text={text} />
    </div>
  );
}
