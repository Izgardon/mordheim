/** A section heading in the battle's scroller: its name and the scroll position that tops it. */
export type JumpHeading = { label: string; top: number };

/** Where the Jump button goes next: the section, where to scroll, and whether that is back up. */
export type Jump = { label: string; top: number; up: boolean };

/**
 * The Jump button's next stop from `scrollTop` (William, 26 Nov 2026: "floating button that just
 * cycles through the 3/4 unit sections"): the first heading below it, and from the last section
 * (or the bottom of the list) back up to the first. None with fewer than two sections.
 */
export function nextJump(
  headings: JumpHeading[],
  scrollTop: number,
  maxScroll: number
): Jump | null {
  if (headings.length < 2) return null;
  const reach = (top: number) => Math.max(0, Math.min(maxScroll, top));
  if (scrollTop < maxScroll - 1) {
    const next = headings.find((heading) => reach(heading.top) > scrollTop + 1);
    if (next) return { label: next.label, top: reach(next.top), up: false };
  }
  const first = headings[0];
  const top = reach(first.top);
  // the first heading can't come any higher (a short list): back to the top of the list
  return { label: first.label, top: top < scrollTop - 1 ? top : 0, up: true };
}

export const sameJump = (a: Jump | null, b: Jump | null) =>
  a === b || Boolean(a && b && a.label === b.label && a.top === b.top && a.up === b.up);
