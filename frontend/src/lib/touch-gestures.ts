/** Controls whose touches are their own: a field, a slider, a stepper, anything marked so. */
const OWN_GESTURES = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="slider"]',
  "[data-no-sheet-drag]",
].join(", ");

/**
 * Whether `target` sits in a row that scrolls sideways (a `.scroll-row` of chips, or anything else
 * whose overflow-x scrolls and holds more than it shows), up to `root`: its swipes are that row's.
 */
export function inSidewaysScroller(target: EventTarget | null, root?: Element | null) {
  let node = target instanceof Element ? target : null;
  while (node && node !== root) {
    if (node.classList.contains("scroll-row")) return true;
    const { overflowX } = getComputedStyle(node);
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * The panes that scroll up and down on the way from `target` to `root` (a sheet's body, the battle
 * feed): a drag that starts in one is first that pane's to scroll.
 */
export function scrollPanes(target: EventTarget | null, root: Element) {
  const panes: Element[] = [];
  let node = target instanceof Element ? target : null;
  while (node && node !== root) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      panes.push(node);
    }
    node = node.parentElement;
  }
  return panes;
}

/** Whether a drag starting at `target` belongs to the control under it rather than to a sheet. */
export function ownsItsGestures(target: EventTarget | null, root?: Element | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(OWN_GESTURES)) || inSidewaysScroller(target, root);
}

/** Whether a dialog, drawer or sheet is open over the page. */
export function dialogOpen() {
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));
}
