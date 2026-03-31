import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";

import ItemSellDialog from "../../shared/dialogs/ItemSellDialog";
import ItemMoveDialog from "../../shared/dialogs/ItemMoveDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog/AcquireItemDialog";

import type { WarbandHero, WarbandItemSummary } from "../../../types/warband-types";

import { ExitIcon } from "@components/exit-icon";
import useStashActions from "../../../hooks/warband/useStashActions";
import { useMediaQuery } from "@/lib/use-media-query";
import { Button } from "@components/button";

type StashItemListProps = {
  items: WarbandItemSummary[];
  warbandId: number;
  isLoading?: boolean;
  error?: string;
  onClose?: () => void;
  onItemsChanged?: () => void;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  canEdit?: boolean;
  inSheet?: boolean;
};

function getFloatingMenuPosition(anchorRect: DOMRect, actionCount: number) {
  const viewportPadding = 12;
  const gap = 4;
  const menuWidth = 112;
  const estimatedRowHeight = 31;
  const menuHeight = actionCount * estimatedRowHeight;
  const spaceBelow =
    window.innerHeight - anchorRect.bottom - viewportPadding - gap;
  const spaceAbove = anchorRect.top - viewportPadding - gap;

  let top =
    spaceBelow < menuHeight && spaceAbove > spaceBelow
      ? anchorRect.top - menuHeight - gap
      : anchorRect.bottom + gap;

  top = Math.max(
    viewportPadding,
    Math.min(top, window.innerHeight - viewportPadding - menuHeight)
  );

  let left = anchorRect.right - menuWidth;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - viewportPadding - menuWidth)
  );

  return { top, left, menuWidth };
}

export default function StashItemList({
  items,
  warbandId,
  isLoading = false,
  error = "",
  onClose,
  onItemsChanged,
  onHeroUpdated,
  canEdit = false,
  inSheet = false,
}: StashItemListProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 960px)");

  const {
    openMenu,
    setOpenMenu,
    itemDialog,
    setItemDialog,
    acquireItem,
    setAcquireItem,
    henchmenGroups,
    entries,
    warband,
    handleMenuToggle,
    handleMenuAction,
    handleSellConfirm,
    handleMoveConfirm,
  } = useStashActions({ items, warbandId, onItemsChanged, onHeroUpdated });

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu, setOpenMenu]);

  useEffect(() => {
    if (!canEdit && openMenu) {
      setOpenMenu(null);
    }
  }, [canEdit, openMenu, setOpenMenu]);

  const menuActions = ["Sell", "Move", "Buy again"] as const;
  const menuPosition = openMenu
    ? getFloatingMenuPosition(openMenu.rect, menuActions.length)
    : null;
  const menuContent = openMenu && canEdit ? (
    <div
      ref={menuRef}
      data-allow-dialog-interaction
      className="fixed z-[9999] min-w-[100px] rounded border border-white/20 bg-neutral-900 shadow-lg"
      style={{
        top: menuPosition?.top,
        left: menuPosition?.left,
        width: menuPosition?.menuWidth,
      }}
    >
      {menuActions.map((action) => (
        <button
          key={action}
          type="button"
          className="block w-full cursor-pointer border-none bg-transparent px-3 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:bg-white/10 hover:text-accent"
          onClick={() => handleMenuAction(action, openMenu.entry)}
        >
          {action}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div
        className={inSheet ? "space-y-2" : `relative space-y-2 p-3 ${isMobile ? "rounded-md border border-[#2b2117]/80 bg-[#15100c] shadow-[0_14px_28px_rgba(6,4,2,0.45)]" : ""}`}
        style={
          inSheet || isMobile
            ? undefined
            : {
                borderRadius: "0.75rem",
                border: "1px solid rgba(110, 90, 59, 0.45)",
                backgroundColor: "rgba(18, 15, 11, 0.96)",
                boxShadow: "0 18px 32px rgba(6,4,2,0.38)",
              }
        }
      >
        {!inSheet ? (
          <Button
            type="button"
            variant="toolbar"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={onClose}
            aria-label="Close warband stash"
          >
            <ExitIcon className="h-5 w-5" />
          </Button>
        ) : null}
        {!inSheet ? (
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-muted-foreground">
            Warband Stash
          </p>
        ) : null}
        <div className={inSheet ? "overflow-y-auto pr-1" : "min-h-[10rem] max-h-[12rem] overflow-y-auto pr-1"}>
          {isLoading ? (
            <div className="flex h-full min-h-[8rem] items-center justify-center text-sm text-muted-foreground">
              Loading stash...
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[8rem] items-center justify-center text-sm text-red-400">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-full min-h-[8rem] items-center justify-center text-sm text-muted-foreground">
              Empty
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {entry.label}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-foreground/50 transition-colors duration-150 hover:text-foreground"
                      onClick={(e) => handleMenuToggle(entry, e)}
                    >
                      <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
                        <circle cx="1.5" cy="1.5" r="1.5" />
                        <circle cx="1.5" cy="6.5" r="1.5" />
                        <circle cx="1.5" cy="11.5" r="1.5" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {inSheet ? menuContent : menuContent ? createPortal(menuContent, document.body) : null}
      {itemDialog?.action === "sell" && (
        <ItemSellDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          itemCost={itemDialog.item.cost}
          maxQuantity={itemDialog.count}
          onConfirm={({ quantity, price }) =>
            handleSellConfirm(itemDialog.item, quantity, price)
          }
        />
      )}
      {itemDialog?.action === "move" && (
        <ItemMoveDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          maxQuantity={itemDialog.count}
          unitTypes={["heroes", "hiredswords", "henchmen"]}
          units={{
            heroes: warband?.heroes ?? [],
            hiredswords: warband?.hired_swords ?? [],
            henchmen: henchmenGroups,
          }}
          onConfirm={({ quantity, unitType, unitId }) =>
            handleMoveConfirm(itemDialog.item, quantity, unitType, unitId)
          }
        />
      )}
      {acquireItem && (
        <AcquireItemDialog
          item={acquireItem}
          open
          onOpenChange={(open) => { if (!open) setAcquireItem(null); }}
          trigger={null}
          variant="buy-again"
          presetUnitType="stash"
          onAcquire={() => { onItemsChanged?.(); }}
        />
      )}
    </>
  );
}
