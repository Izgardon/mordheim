import ItemSellDialog from "./dialogs/ItemSellDialog";
import ItemMoveDialog from "./dialogs/ItemMoveDialog";
import FloatingItemMenu from "./FloatingItemMenu";
import AcquireItemDialog from "../../../items/components/AcquireItemDialog/AcquireItemDialog";

import type { UnitTypeOption } from "@components/unit-selection-section";
import type { HenchmenGroup, WarbandHero, WarbandHiredSword } from "../../types/warband-types";
import type { ItemActionMenu } from "../../hooks/useItemActionMenu";

const MENU_ACTIONS = ["Sell", "Move", "Buy again"] as const;

type ItemActionDialogsProps = {
  menu: ItemActionMenu;
  canEdit: boolean;
  /** The unit whose items these are (it is no Move target of its own); none for the stash. */
  owner?: { kind: Exclude<UnitTypeOption, "stash">; id: number };
  /** Render the menu in place (the stash inside a sheet) instead of on the page body. */
  menuInPlace?: boolean;
  /** After Buy again (its answer is in the cache already). */
  onAcquire?: () => void;
};

type MoveUnit = WarbandHero | WarbandHiredSword | HenchmenGroup;

/** The item menu and what it opens: Sell, Move (to the warband on screen) and Buy again. */
export default function ItemActionDialogs({
  menu,
  canEdit,
  owner,
  menuInPlace = false,
  onAcquire,
}: ItemActionDialogsProps) {
  const { openMenu, itemDialog, setItemDialog, buyAgainItem, setBuyAgainItem, warband } = menu;
  const others = <U extends MoveUnit>(kind: UnitTypeOption, units: U[] = []) =>
    owner?.kind === kind ? units.filter((unit) => unit.id !== owner.id) : units;
  const moveUnits: Partial<Record<UnitTypeOption, MoveUnit[]>> = {
    heroes: others("heroes", warband?.heroes),
    hiredswords: others("hiredswords", warband?.hired_swords),
    henchmen: others("henchmen", warband?.henchmen_groups),
  };
  const moveTypes: UnitTypeOption[] = owner
    ? ["heroes", "hiredswords", "henchmen", "stash"]
    : ["heroes", "hiredswords", "henchmen"];

  return (
    <>
      {openMenu && canEdit ? (
        <FloatingItemMenu
          anchorRect={openMenu.rect}
          actions={MENU_ACTIONS}
          menuRef={menu.menuRef}
          onAction={(action) => menu.handleMenuAction(action, openMenu.entry)}
          inPlace={menuInPlace}
        />
      ) : null}
      {itemDialog?.action === "sell" && (
        <ItemSellDialog
          open
          onOpenChange={(open) => {
            if (!open) setItemDialog(null);
          }}
          itemName={itemDialog.item.name}
          itemCost={itemDialog.item.cost}
          maxQuantity={itemDialog.count}
          onConfirm={({ quantity, price }) => menu.handleSell(itemDialog.item, quantity, price)}
        />
      )}
      {itemDialog?.action === "move" && (
        <ItemMoveDialog
          open
          onOpenChange={(open) => {
            if (!open) setItemDialog(null);
          }}
          itemName={itemDialog.item.name}
          maxQuantity={itemDialog.count}
          unitTypes={moveTypes}
          units={moveUnits}
          onConfirm={({ quantity, unitType, unitId }) =>
            menu.handleMove(itemDialog.item, quantity, unitType as string, unitId)
          }
        />
      )}
      {buyAgainItem && (
        <AcquireItemDialog
          item={buyAgainItem}
          open
          onOpenChange={(open) => {
            if (!open) setBuyAgainItem(null);
          }}
          trigger={null}
          variant="buy-again"
          {...(owner
            ? {
                presetUnitType: owner.kind,
                presetUnitId: owner.id,
                disableUnitSelection: true,
                defaultUnitSectionCollapsed: true,
                defaultRaritySectionCollapsed: false,
                defaultPriceSectionCollapsed: false,
              }
            : { presetUnitType: "stash" as const })}
          onAcquire={() => onAcquire?.()}
        />
      )}
    </>
  );
}
