/** The item menus' width and their rows' estimated height, for placing them before they render. */
export const FLOATING_MENU_WIDTH = 112;
const ESTIMATED_ROW_HEIGHT = 31;
const VIEWPORT_PADDING = 12;
const GAP = 4;

type Viewport = { width: number; height: number };

/**
 * Where a floating menu of `actionCount` rows goes for the button at `anchorRect`: below it,
 * right-aligned, or above it when there is more room there; always inside the viewport.
 */
export function getFloatingMenuPosition(
  anchorRect: Pick<DOMRect, "top" | "bottom" | "right">,
  actionCount: number,
  viewport: Viewport = { width: window.innerWidth, height: window.innerHeight }
) {
  const menuHeight = actionCount * ESTIMATED_ROW_HEIGHT;
  const spaceBelow = viewport.height - anchorRect.bottom - VIEWPORT_PADDING - GAP;
  const spaceAbove = anchorRect.top - VIEWPORT_PADDING - GAP;

  let top =
    spaceBelow < menuHeight && spaceAbove > spaceBelow
      ? anchorRect.top - menuHeight - GAP
      : anchorRect.bottom + GAP;
  top = Math.max(VIEWPORT_PADDING, Math.min(top, viewport.height - VIEWPORT_PADDING - menuHeight));

  let left = anchorRect.right - FLOATING_MENU_WIDTH;
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, viewport.width - VIEWPORT_PADDING - FLOATING_MENU_WIDTH)
  );

  return { top, left, menuWidth: FLOATING_MENU_WIDTH };
}
