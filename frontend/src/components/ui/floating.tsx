import * as React from "react";

/** With less room than this below its field, a list opens over it (when there is more room). */
const MIN_ROOM = 160;
/** Kept between a list and the window's edge. */
const EDGE = 8;

type Place = { top: number; left: number; width: number; maxHeight: number; up: boolean };

const samePlace = (a: Place | null, b: Place) =>
  Boolean(
    a &&
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.maxHeight === b.maxHeight &&
      a.up === b.up
  );

/**
 * Where a dropdown list opens: under its field, or over it when the window has no room below,
 * as wide as the field. It is `position: fixed`, so the scrolling body of a modal, drawer or
 * sheet never clips it and it runs past the modal's edge (William, 7 Nov 2026: "dropdowns in
 * modals should be able to extend out of them"), while it stays where it is in the page: inside
 * the modal for its focus trap, Tab order, scrolling and outside clicks. A fixed box is placed
 * against its containing block (a modal with a transform, else the window), which `origin`, a
 * zero-size fixed probe beside the list, measures; the place is measured every frame while open,
 * so the list follows its field as the body scrolls.
 */
export function useFloating(open: boolean, { maxHeight = 288, gap = 0 } = {}) {
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const originRef = React.useRef<HTMLSpanElement | null>(null);
  const [place, setPlace] = React.useState<Place | null>(null);

  React.useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const origin = originRef.current?.getBoundingClientRect();
      if (anchor && origin) {
        const below = window.innerHeight - anchor.bottom - gap - EDGE;
        const above = anchor.top - gap - EDGE;
        const up = below < Math.min(maxHeight, MIN_ROOM) && above > below;
        const next = {
          top: Math.round((up ? anchor.top - gap : anchor.bottom + gap) - origin.top),
          left: Math.round(anchor.left - origin.left),
          width: Math.round(anchor.width),
          maxHeight: Math.round(Math.max(Math.min(maxHeight, up ? above : below), 96)),
          up,
        };
        setPlace((current) => (samePlace(current, next) ? current : next));
      }
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [open, maxHeight, gap]);

  const style: React.CSSProperties = place
    ? {
        position: "fixed",
        top: place.top,
        left: place.left,
        width: place.width,
        maxHeight: place.maxHeight,
        transform: place.up ? "translateY(-100%)" : undefined,
      }
    : { position: "fixed", visibility: "hidden" };
  /** The probe: render it beside the list, in the same parent. */
  const origin = (
    <span
      ref={originRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 h-0 w-0"
    />
  );
  return { anchorRef, origin, style, up: place?.up ?? false };
}
