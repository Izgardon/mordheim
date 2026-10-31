import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import type { FeedLine } from "@/features/battles/utils/battle-feed";
import { cn } from "@/lib/utils";

type BattleFeedProps = {
  lines: FeedLine[];
  onUndo: (eventId: number) => void;
  /** The list's height: a short box on a phone, a tall column on the web. */
  className?: string;
};

/** Undo stays on your own kills and item uses among the latest lines. */
const UNDO_WINDOW = 12;

const nearBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight < 24;

/**
 * The battle feed (design E): the battle's events in plain words in their own scrolling box,
 * newest at the bottom. It follows new lines while you're at the bottom; scrolled up, an arrow
 * jumps back to the latest. Your own recent kills and item uses carry Undo.
 */
export default function BattleFeed({ lines, onUndo, className }: BattleFeedProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const followRef = useRef(true);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && followRef.current) list.scrollTop = list.scrollHeight;
  }, [lines.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      const bottom = nearBottom(list);
      followRef.current = bottom;
      setAtBottom(bottom);
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  const toLatest = () => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    followRef.current = true;
    setAtBottom(true);
  };
  const firstUndoable = Math.max(0, lines.length - UNDO_WINDOW);

  return (
    <section
      aria-labelledby="feed-h"
      className="relative flex flex-col border border-border bg-bar"
    >
      <h2
        id="feed-h"
        className="m-0 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-faint"
      >
        Battle feed
      </h2>
      <ol
        ref={listRef}
        aria-live="polite"
        className={cn("m-0 flex list-none flex-col overflow-y-auto px-3 pb-2", className)}
      >
        {lines.length === 0 ? (
          <li className="py-1.5 text-xs text-muted-foreground">Nothing has happened yet.</li>
        ) : null}
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="flex items-baseline gap-2.5 border-t border-line py-[5px] text-xs"
          >
            <span className="w-6 shrink-0 font-mono text-[11px] text-faint">R{line.round}</span>
            <span
              className={cn(
                "min-w-0 flex-1",
                line.kill ? "text-ink" : "text-muted-foreground",
                line.voided && "line-through opacity-70"
              )}
            >
              {line.text}
              {line.voided ? " (undone)" : ""}
            </span>
            {line.undoable && index >= firstUndoable ? (
              <button
                type="button"
                onClick={() => onUndo(line.id)}
                className="shrink-0 text-[11px] font-bold text-accent-text underline underline-offset-2"
              >
                Undo
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {atBottom ? null : (
        <button
          type="button"
          aria-label="Back to the latest"
          onClick={toLatest}
          className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center border border-accent-line bg-panel text-accent-hi"
        >
          <ArrowDown className="h-[15px] w-[15px]" strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
