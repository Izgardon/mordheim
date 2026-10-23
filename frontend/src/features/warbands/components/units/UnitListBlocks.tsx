import { useEffect, useState, type MouseEvent } from "react";

import UnitListBlocksShell, { type UnitListPopup } from "../shared/blocks/UnitListBlocks";
import ItemActionDialogs from "../shared/ItemActionDialogs";
import LoadoutEntryRow from "./LoadoutEntryRow";

import { itemMutationUpdate } from "../../api/economy-queries";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import useItemActionMenu from "../../hooks/useItemActionMenu";
import { useCompanionSwitch } from "../../hooks/units/useCompanionSwitch";
import { buildLoadoutBlocks, type LoadoutBlock, type LoadoutEntry } from "./loadout-blocks";

import type { PopupPosition } from "../shared/unit_details/DetailPopup";
import type { Unit, UnitKindKey } from "../../types/units";
import type { WarbandUnitDetail } from "../../types/warband-types";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type PendingTab = "skills" | "spells" | "special";

type UnitListBlocksProps<K extends UnitKindKey> = {
  kind: UnitKindConfig<K>;
  unit: Unit<K>;
  warbandId: number;
  variant?: "summary" | "detailed";
  fullWidthItems?: boolean;
  summaryRowCount?: number;
  summaryScrollable?: boolean;
  onUnitUpdated?: (updated: Unit<K>) => void;
  onPendingEntryClick?: (unitId: number, tab: PendingTab) => void;
  onPendingSpellClick?: () => void;
  onPendingSkillClick?: () => void;
  spellLookup?: Record<number, { dc?: string | number | null }>;
  /** `edit`: pending "New Skill/Spell/Special" entries open their pickers (BUG-31). */
  canEdit?: boolean;
  /** `manage_items`: the item menus (defaults to canEdit). */
  canManageItems?: boolean;
};

const isUnit = (entry: unknown): entry is WarbandUnitDetail =>
  !!entry && typeof entry === "object" && !("quantity" in entry);

/** The card's loadout tabs (items, skills, spells, specials; henchmen add their roster). */
export default function UnitListBlocks<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  variant = "summary",
  fullWidthItems = false,
  summaryRowCount,
  summaryScrollable,
  onUnitUpdated,
  onPendingEntryClick,
  onPendingSpellClick,
  onPendingSkillClick,
  spellLookup,
  canEdit = false,
  canManageItems = canEdit,
}: UnitListBlocksProps<K>) {
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { hasMembers } = kind.flags;
  const updateWarbandCache = useWarbandCacheUpdate();

  const itemMenu = useItemActionMenu({
    source: { kind: kind.section, unit },
    warbandId,
    canEdit: canManageItems,
    onSourceUpdated: onUnitUpdated,
    onMutationComplete: (result) => {
      const sameKindTarget = result.targetUnitType === kind.section ? result.target : null;
      if (kind.flags.reportsMoveTarget && isUnit(sameKindTarget)) {
        onUnitUpdated?.(sameKindTarget as Unit<K>);
      }
      // A unit of another kind that received the item goes into its own list (BUG-86).
      updateWarbandCache(
        warbandId,
        itemMutationUpdate(result, { listKey: kind.listKey, units: [unit] })
      );
    },
  });

  const companionSwitch = useCompanionSwitch(kind, warbandId);
  /** A mount's or pet's switch: its copy on or off for this unit (creatures recruit instead). */
  const beastClick = ({ beast, label }: LoadoutEntry) => {
    if (!beast || beast.kind === "creature" || beast.rowId === null) return undefined;
    const change = { unitId: unit.id, rowId: beast.rowId, on: !beast.on, name: label };
    return (event: MouseEvent) => {
      event.stopPropagation();
      companionSwitch.mutate(change);
    };
  };

  const blocks = buildLoadoutBlocks(kind, unit, spellLookup);

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  if (blocks.length === 0) {
    return null;
  }

  const handleEntryClick = (entry: LoadoutEntry, event: MouseEvent) => {
    if (entry.type === "roster") {
      return;
    }
    // Viewers see a pending entry like any other; only editors resolve it.
    const resolvesPending = entry.pending && canEdit;
    if (resolvesPending && entry.type === "spell" && onPendingSpellClick) {
      onPendingSpellClick();
      return;
    }
    if (resolvesPending && entry.type === "skill" && onPendingSkillClick) {
      onPendingSkillClick();
      return;
    }
    if (resolvesPending && onPendingEntryClick && entry.type !== "item") {
      onPendingEntryClick(
        unit.id,
        entry.type === "skill" ? "skills" : entry.type === "spell" ? "spells" : "special"
      );
      return;
    }

    if (openPopups.some((popup) => popup.key === entry.id)) {
      setOpenPopups((prev) => prev.filter((popup) => popup.key !== entry.id));
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setOpenPopups((prev) => [
      ...prev,
      {
        entry: {
          id: entry.visibleId,
          type: entry.type as "item" | "skill" | "spell" | "special",
          name: entry.label,
          ...(hasMembers ? {} : { dc: entry.type === "spell" ? entry.dc : undefined }),
        },
        anchorRect: rect,
        key: entry.id,
      },
    ]);
  };

  const gridClassName = (block: LoadoutBlock, view: "summary" | "detailed") => {
    if (view === "detailed" || block.id === "roster") {
      return "grid grid-cols-1 gap-y-1 text-sm";
    }
    if (fullWidthItems && block.id === "items") {
      return "grid grid-cols-1 gap-y-1 text-sm";
    }
    return "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
  };

  return (
    <>
      <UnitListBlocksShell
        blocks={blocks}
        variant={variant}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        renderEntry={(entry) => (
          <LoadoutEntryRow
            entry={entry}
            memberCount={
              hasMembers ? ("henchmen" in unit ? (unit.henchmen ?? []).length : 0) : null
            }
            canEdit={canManageItems}
            onClick={(event) => handleEntryClick(entry, event)}
            onMenuClick={(event) => itemMenu.handleMenuToggle(entry, event)}
            onBeastClick={beastClick(entry)}
            beastBusy={companionSwitch.isPending}
          />
        )}
        summaryRowCount={summaryRowCount}
        summaryScrollable={summaryScrollable}
        // Henchmen always size the grid (their roster is one column); the others only full-width.
        getGridClassName={hasMembers || fullWidthItems ? gridClassName : undefined}
        popups={openPopups}
        onPopupClose={(key) => setOpenPopups((prev) => prev.filter((popup) => popup.key !== key))}
        onPopupPositionCalculated={(key: string, position: PopupPosition) =>
          setOpenPopups((prev) =>
            prev.map((popup) => (popup.key === key ? { ...popup, position } : popup))
          )
        }
      />
      <ItemActionDialogs
        menu={itemMenu}
        canEdit={canManageItems}
        owner={{ kind: kind.section, id: unit.id }}
      />
    </>
  );
}
