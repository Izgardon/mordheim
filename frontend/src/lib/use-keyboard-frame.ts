import { useEffect, useSyncExternalStore, type CSSProperties } from "react";

/**
 * What the on-screen keyboard leaves of the screen: the visible height and how far above the
 * layout viewport's bottom it ends, in CSS px.
 */
export type KeyboardFrame = { height: number; bottom: number };

/** Less than this covered is the browser's own bars settling, not a keyboard. */
const KEYBOARD_MIN = 100;

let current: KeyboardFrame | null = null;

/**
 * The frame while a keyboard covers part of the page, else null. Android Chrome resizes the page
 * itself (`interactive-widget=resizes-content` in index.html), so this is iOS Safari's case,
 * where the keyboard only shrinks the visual viewport. A pinch zoom shrinks it too, but scaled:
 * the height times the scale still fills the layout viewport.
 */
function read(): KeyboardFrame | null {
  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
  if (!viewport) return null;
  const covered = window.innerHeight - viewport.height * viewport.scale;
  if (covered < KEYBOARD_MIN) return null;
  return {
    height: Math.round(viewport.height),
    bottom: Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)),
  };
}

const snapshot = () => {
  const next = read();
  if (next?.height !== current?.height || next?.bottom !== current?.bottom) current = next;
  return current;
};

function subscribe(changed: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", changed);
  viewport?.addEventListener("scroll", changed);
  window.addEventListener("resize", changed);
  return () => {
    viewport?.removeEventListener("resize", changed);
    viewport?.removeEventListener("scroll", changed);
    window.removeEventListener("resize", changed);
  };
}

const never = () => () => undefined;
const none = () => null;

const EDITABLE = "input, textarea, select, [contenteditable='true']";

/**
 * The keyboard's frame while `active` (an open sheet or phone dialog), and the focused field
 * scrolled back into view whenever the frame changes, so it stays above the keyboard.
 */
export function useKeyboardFrame(active: boolean): KeyboardFrame | null {
  const frame = useSyncExternalStore(active ? subscribe : never, active ? snapshot : none, none);
  const height = frame?.height;
  const bottom = frame?.bottom;
  useEffect(() => {
    if (height === undefined) return;
    const id = window.requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.matches(EDITABLE)) {
        focused.scrollIntoView({ block: "nearest" });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [height, bottom]);
  return frame;
}

/**
 * A sheet fixed to the bottom of the screen sat on the keyboard, as tall as what it leaves less
 * the status bar; nothing while the keyboard is down, so the sheet's own classes hold.
 */
export function keyboardSheetStyle(frame: KeyboardFrame | null): CSSProperties | undefined {
  return frame
    ? {
        bottom: `${frame.bottom}px`,
        maxHeight: `calc(${frame.height}px - env(safe-area-inset-top, 0px))`,
      }
    : undefined;
}
