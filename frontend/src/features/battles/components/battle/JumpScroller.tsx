import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { nextJump, sameJump, type Jump } from "./jump";

/** The list's top padding: a heading jumped to sits where the list starts, under the bars. */
const TOP_GAP = 10;

/** How long a jump's smooth scroll may take before the next one reads the real position. */
const SETTLE_MS = 900;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The phone battle screen's scrolling list, with the Jump button floating over its foot (William,
 * 26 Nov 2026: "floating button that just cycles through the 3/4 unit sections, just call it jump
 * with an appropriate directioned arrow"). It finds the section headings WarbandUnits marks with
 * `data-jump-section`, follows the scroll position, and is left out with fewer than two sections.
 */
export default function JumpScroller({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // where a jump under way is going, so a quick second tap goes on to the section after it
  const pending = useRef<number | null>(null);
  const settle = useRef<number | undefined>(undefined);
  const [jump, setJump] = useState<Jump | null>(null);

  const read = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    const box = scroller.getBoundingClientRect().top;
    const headings = [...scroller.querySelectorAll<HTMLElement>("[data-jump-section]")].map(
      (heading) => ({
        label: heading.textContent ?? "",
        top: heading.getBoundingClientRect().top - box + scroller.scrollTop - TOP_GAP,
      })
    );
    const max = scroller.scrollHeight - scroller.clientHeight;
    return nextJump(headings, pending.current ?? scroller.scrollTop, max);
  }, []);

  const update = useCallback(() => {
    const next = read();
    setJump((current) => (sameJump(current, next) ? current : next));
  }, [read]);

  // every render: another side picked, or units come and go, moves the headings
  useLayoutEffect(update);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const onEnd = () => {
      pending.current = null;
      update();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", onEnd);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle.current);
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", onEnd);
    };
  }, [update]);

  const go = () => {
    const scroller = scrollerRef.current;
    const target = read();
    if (!scroller || !target) return;
    pending.current = target.top;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      pending.current = null;
      update();
    }, SETTLE_MS);
    scroller.scrollTo({ top: target.top, behavior: reducedMotion() ? "auto" : "smooth" });
    update();
  };

  const Arrow = jump?.up ? ArrowUp : ArrowDown;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-3 pt-2.5",
          // room under the last card, so the button never sits on its controls at the bottom
          jump ? "pb-16" : "pb-6"
        )}
      >
        {children}
      </div>
      {jump ? (
        <button
          type="button"
          aria-label={`Jump to ${jump.label}`}
          onClick={go}
          className="absolute bottom-3 right-3 z-10 flex min-h-11 items-center gap-1.5 border border-accent-line bg-raised px-3 text-[13px] font-bold text-accent-hi shadow-[0_6px_18px_var(--color-shadow)]"
        >
          Jump
          <Arrow className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
