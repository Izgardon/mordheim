import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Keeps the expanded card's grid slot wide for the 200ms exit animation, so the card doesn't
 * snap into a narrow column before it fades out. Kinds that ask for it also scroll the section
 * into view when a card expands on desktop (today: hired swords only).
 */
export function useSectionExpansion(
  expandedId: number | null,
  { scrollIntoView, isMobileLayout }: { scrollIntoView: boolean; isMobileLayout: boolean }
): { visuallyExpandedId: number | null; sectionRef: RefObject<HTMLDivElement> } {
  const [visuallyExpandedId, setVisuallyExpandedId] = useState(expandedId);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  // Read when a card expands, not a reason to scroll again when the layout changes.
  const isMobileLayoutRef = useRef(isMobileLayout);
  isMobileLayoutRef.current = isMobileLayout;

  useEffect(() => {
    if (expandedId !== null) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      setVisuallyExpandedId(expandedId);
    } else {
      collapseTimerRef.current = setTimeout(() => setVisuallyExpandedId(null), 200);
    }
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [expandedId]);

  useEffect(() => {
    if (!scrollIntoView || !expandedId || isMobileLayoutRef.current) return;
    const node = sectionRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedId, scrollIntoView]);

  return { visuallyExpandedId, sectionRef };
}
