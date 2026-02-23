import { createPortal } from "react-dom";

import ItemSellDialog from "./dialogs/ItemSellDialog";
import ItemMoveDialog from "./dialogs/ItemMoveDialog";
import AcquireItemDialog from "../../../items/components/AcquireItemDialog/AcquireItemDialog";

import type { UnitTypeOption } from "@components/unit-selection-section";
import type { Item } from "../../../items/types/item-types";
import type { HenchmenGroup, Warband, WarbandHero, WarbandHiredSword } from "../../types/warband-types";
import type { OpenMenu, ItemDialogState } from "../../hooks/useUnitItemMenu";

type UnitItemDialogsProps = {
  openMenu: OpenMenu | null;
  canEdit: boolean;
  menuRef: React.RefObject<HTMLDivElement>;
  handleMenuAction: (action: string, entry: OpenMenu["entry"]) => void;
  itemDialog: ItemDialogState;
  setItemDialog: (state: ItemDialogState) => void;
  handleSellItem: (item: Item, qty: number, price: number) => Promise<void>;
  handleMoveItem: (item: Item, qty: number, unitType: string, unitId: string) => Promise<void>;
  buyAgainItem: Item | null;
  setBuyAgainItem: (item: Item | null) => void;
  warband: Warband | null;
  henchmenGroups: HenchmenGroup[];
  selfExcludeType: "heroes" | "hiredswords" | "henchmen";
  selfId: number;
  presetUnitType: UnitTypeOption;
  onAcquire: () => Promise<void>;
  menuActions?: string[];
};

export default function UnitItemDialogs({
  openMenu,
  canEdit,
  menuRef,
  handleMenuAction,
  itemDialog,
  setItemDialog,
  handleSellItem,
  handleMoveItem,
  buyAgainItem,
  setBuyAgainItem,
  warband,
  henchmenGroups,
  selfExcludeType,
  selfId,
  presetUnitType,
  onAcquire,
  menuActions = ["Sell", "Move", "Buy again"],
}: UnitItemDialogsProps) {
  const moveUnits: Partial<Record<UnitTypeOption, (WarbandHero | WarbandHiredSword | HenchmenGroup)[]>> = {
    heroes: selfExcludeType === "heroes"
      ? (warband?.heroes ?? []).filter((h) => h.id !== selfId)
      : warband?.heroes ?? [],
    hiredswords: selfExcludeType === "hiredswords"
      ? (warband?.hired_swords ?? []).filter((hs) => hs.id !== selfId)
      : warband?.hired_swords ?? [],
    henchmen: selfExcludeType === "henchmen"
      ? henchmenGroups.filter((g) => g.id !== selfId)
      : henchmenGroups,
  };

  return (
    <>
      {openMenu && canEdit &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[100px] rounded border border-white/20 bg-neutral-900 py-1 shadow-lg"
            style={{
              top: openMenu.rect.bottom + 4,
              left: openMenu.rect.right - 100,
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
          </div>,
          document.body
        )}
      {itemDialog?.action === "sell" && (
        <ItemSellDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          itemCost={itemDialog.item.cost}
          maxQuantity={itemDialog.count}
          onConfirm={({ quantity, price }) =>
            handleSellItem(itemDialog.item, quantity, price)
          }
        />
      )}
      {itemDialog?.action === "move" && (
        <ItemMoveDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          maxQuantity={itemDialog.count}
          unitTypes={["heroes", "hiredswords", "henchmen", "stash"]}
          units={moveUnits}
          onConfirm={({ quantity, unitType, unitId }) =>
            handleMoveItem(itemDialog.item, quantity, unitType as string, unitId)
          }
        />
      )}
      {buyAgainItem && (
        <AcquireItemDialog
          item={buyAgainItem}
          open
          onOpenChange={(open) => { if (!open) setBuyAgainItem(null); }}
          trigger={null}
          variant="buy-again"
          presetUnitType={presetUnitType}
          presetUnitId={selfId}
          disableUnitSelection
          defaultUnitSectionCollapsed
          defaultRaritySectionCollapsed={false}
          defaultPriceSectionCollapsed={false}
          onAcquire={async () => {
            await onAcquire();
          }}
        />
      )}
    </>
  );
}
