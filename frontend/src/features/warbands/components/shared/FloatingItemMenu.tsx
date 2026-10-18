import type { RefObject } from "react";
import { createPortal } from "react-dom";

import { getFloatingMenuPosition } from "./floating-menu";

type FloatingItemMenuProps = {
  anchorRect: DOMRect;
  actions: readonly string[];
  menuRef: RefObject<HTMLDivElement>;
  onAction: (action: string) => void;
  /** Render in place (inside a sheet) instead of in a portal on the page body. */
  inPlace?: boolean;
};

/** An item's action menu (Sell, Move, Buy again), floating next to its kebab button. */
export default function FloatingItemMenu({
  anchorRect,
  actions,
  menuRef,
  onAction,
  inPlace = false,
}: FloatingItemMenuProps) {
  const position = getFloatingMenuPosition(anchorRect, actions.length);
  const menu = (
    <div
      ref={menuRef}
      data-allow-dialog-interaction
      className="fixed z-[9999] min-w-[100px] rounded border border-white/20 bg-neutral-900 shadow-lg"
      style={{ top: position.top, left: position.left, width: position.menuWidth }}
    >
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className="block w-full cursor-pointer border-none bg-transparent px-3 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:bg-white/10 hover:text-accent"
          onClick={() => onAction(action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
  return inPlace ? menu : createPortal(menu, document.body);
}
