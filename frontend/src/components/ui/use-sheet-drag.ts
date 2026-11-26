import { useCallback, useLayoutEffect, useRef } from "react";

import { ownsItsGestures, scrollPanes } from "@/lib/touch-gestures";

/**
 * How far a sheet must be dragged down before letting go closes it: a third of its height, at
 * least `SHEET_DISMISS_MIN` (a short sheet still needs a real pull) and at most `SHEET_DISMISS_MAX`
 * (a tall one never needs a whole-screen drag).
 */
export const SHEET_DISMISS_MIN = 100;
export const SHEET_DISMISS_MAX = 220;
export const sheetDismissDistance = (height: number) =>
  Math.min(SHEET_DISMISS_MAX, Math.max(SHEET_DISMISS_MIN, Math.round(height / 3)));
/** How far a finger moves before the gesture counts as a drag, a scroll or a swipe, not a tap. */
const SLOP = 8;
/** A quick flick down closes a sheet dragged less than the distance: px per ms over its last moves. */
const FLICK_SPEED = 0.5;
const FLICK_WINDOW = 100;
const FLICK_TRAVEL = 30;
const SPRING_MS = 200;
/** After a drag, the click its release would make on a button under the finger is swallowed. */
const CLICK_GUARD_MS = 400;

type Gesture = {
  x: number;
  y: number;
  dragging: boolean;
  offset: number;
  samples: { y: number; t: number }[];
};

function flicked(gesture: Gesture, now: number) {
  const recent = gesture.samples.filter((sample) => sample.t >= now - FLICK_WINDOW);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || gesture.offset < FLICK_TRAVEL) return false;
  const elapsed = last.t - first.t;
  return elapsed >= 10 && (last.y - first.y) / elapsed > FLICK_SPEED;
}

/** Makes `sheet` follow a finger (or a mouse on its fixed parts) down; answers the detach. */
function follow(sheet: HTMLElement, close: () => void) {
  let gesture: Gesture | null = null;
  let guardUntil = 0;
  let settle = 0;

  const place = (offset: number, spring: boolean) => {
    window.clearTimeout(settle);
    sheet.style.transition = spring ? `transform ${SPRING_MS}ms ease-out` : "none";
    sheet.style.transform = offset ? `translateY(${offset}px)` : "";
    if (spring) settle = window.setTimeout(() => (sheet.style.transition = ""), SPRING_MS);
  };

  /**
   * A touch drags from anywhere but a control with gestures of its own, and from a scrolling pane
   * only while it sits at its top; a mouse only from what doesn't scroll (handle, header, footer).
   */
  const begin = (target: EventTarget | null, x: number, y: number, touch: boolean) => {
    gesture = null;
    if (ownsItsGestures(target, sheet)) return;
    const panes = scrollPanes(target, sheet);
    if (touch ? panes.some((pane) => pane.scrollTop > 0) : panes.length > 0) return;
    gesture = { x, y, dragging: false, offset: 0, samples: [{ y, t: performance.now() }] };
  };

  /** Moves the sheet with the gesture once it is a drag; answers whether it is one. */
  const move = (x: number, y: number) => {
    if (!gesture) return false;
    const dx = x - gesture.x;
    const dy = y - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
      // decided on the first real movement: up is a scroll, sideways a swipe, for the whole touch
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        gesture = null;
        return false;
      }
      gesture.dragging = true;
    }
    const now = performance.now();
    gesture.offset = Math.max(0, dy);
    gesture.samples.push({ y, t: now });
    while (gesture.samples.length > 1 && gesture.samples[0].t < now - FLICK_WINDOW) {
      gesture.samples.shift();
    }
    place(gesture.offset, false);
    return true;
  };

  const end = (cancelled: boolean) => {
    const done = gesture;
    gesture = null;
    if (!done?.dragging) return;
    const now = performance.now();
    const distance = sheetDismissDistance(sheet.getBoundingClientRect().height);
    const closing = !cancelled && (done.offset > distance || flicked(done, now));
    // closing first: a phone dialog closes through a click on its own Close, which is no stray
    if (closing) close();
    guardUntil = now + CLICK_GUARD_MS;
    if (!closing) {
      place(0, true);
      return;
    }
    // a close that asks first ("Discard changes?") leaves the sheet open, so it springs back
    window.setTimeout(() => {
      if (sheet.isConnected && sheet.dataset.state !== "closed") place(0, true);
    }, 0);
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) end(true);
    else begin(event.target, touch.clientX, touch.clientY, true);
  };
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    // native and non-passive, so this stops the body's scroll and iOS's rubber band
    if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
  };
  const onTouchEnd = () => end(false);
  const onTouchCancel = () => end(true);

  // a phone's touches come as touch events too: these are the mouse's and the pen's
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch" && event.button === 0) {
      begin(event.target, event.clientX, event.clientY, false);
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || !gesture) return;
    const wasDragging = gesture.dragging;
    if (move(event.clientX, event.clientY) && !wasDragging) {
      try {
        sheet.setPointerCapture?.(event.pointerId);
      } catch {
        // the pointer is already gone
      }
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") end(false);
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerType !== "touch") end(true);
  };

  const onClick = (event: MouseEvent) => {
    if (performance.now() > guardUntil) return;
    guardUntil = 0;
    event.preventDefault();
    event.stopPropagation();
  };

  sheet.addEventListener("touchstart", onTouchStart, { passive: true });
  sheet.addEventListener("touchmove", onTouchMove, { passive: false });
  sheet.addEventListener("touchend", onTouchEnd);
  sheet.addEventListener("touchcancel", onTouchCancel);
  sheet.addEventListener("pointerdown", onPointerDown);
  sheet.addEventListener("pointermove", onPointerMove);
  sheet.addEventListener("pointerup", onPointerUp);
  sheet.addEventListener("pointercancel", onPointerCancel);
  sheet.addEventListener("click", onClick, true);
  return () => {
    window.clearTimeout(settle);
    sheet.removeEventListener("touchstart", onTouchStart);
    sheet.removeEventListener("touchmove", onTouchMove);
    sheet.removeEventListener("touchend", onTouchEnd);
    sheet.removeEventListener("touchcancel", onTouchCancel);
    sheet.removeEventListener("pointerdown", onPointerDown);
    sheet.removeEventListener("pointermove", onPointerMove);
    sheet.removeEventListener("pointerup", onPointerUp);
    sheet.removeEventListener("pointercancel", onPointerCancel);
    sheet.removeEventListener("click", onClick, true);
  };
}

/**
 * Drag a phone's bottom sheet down to close it (William, 25 Nov 2026: from anywhere, not just the
 * handle): its header and footer always, its body while scrolled to the top and moving down. The
 * sheet follows the finger and closes past `sheetDismissDistance` of its height or on a quick flick, else
 * springs back. Taps, fields, sliders, steppers, sideways rows and `data-no-sheet-drag` are left
 * alone. The listeners are native so touchmove can be cancelled (React's is passive); the answer
 * is a ref for the sheet's own element (the dialog content).
 */
export function useSheetDrag(onClose: () => void, enabled = true) {
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });
  const detach = useRef<(() => void) | null>(null);
  return useCallback(
    (node: HTMLElement | null) => {
      detach.current?.();
      detach.current = node && enabled ? follow(node, () => closeRef.current()) : null;
    },
    [enabled]
  );
}
