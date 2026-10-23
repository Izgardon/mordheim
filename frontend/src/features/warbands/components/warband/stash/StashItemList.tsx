import ItemActionDialogs from "../../shared/ItemActionDialogs";
import StashItemRow from "./StashItemRow";
import { itemMutationUpdate } from "../../../api/economy-queries";
import { useWarbandCacheUpdate } from "../../../api/warband-cache";

import type { WarbandHero, WarbandItemSummary } from "../../../types/warband-types";

import { ExitIcon } from "@components/exit-icon";
import useItemActionMenu, { stashEntries } from "../../../hooks/useItemActionMenu";
import { useMediaQuery } from "@/lib/use-media-query";
import { Button } from "@components/button";

type StashItemListProps = {
  items: WarbandItemSummary[];
  warbandId: number;
  isLoading?: boolean;
  error?: string;
  onClose?: () => void;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  canEdit?: boolean;
  inSheet?: boolean;
};

/** The warband stash: its rows, each with Sell, Move and Buy again for editors. */
export default function StashItemList({
  items,
  warbandId,
  isLoading = false,
  error = "",
  onClose,
  onHeroUpdated,
  canEdit = false,
  inSheet = false,
}: StashItemListProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const updateWarbandCache = useWarbandCacheUpdate();
  const entries = stashEntries(items);
  const menu = useItemActionMenu({
    source: { kind: "stash", items },
    warbandId,
    canEdit,
    onMutationComplete: (result) => {
      if (result.targetUnitType === "heroes" && result.target && !("quantity" in result.target)) {
        onHeroUpdated?.(result.target as WarbandHero);
      }
      // The answer carries the stash row (or its removal): no stash reload (ECON-PERF-08).
      updateWarbandCache(warbandId, itemMutationUpdate(result));
    },
  });

  return (
    <>
      <div
        className={
          inSheet
            ? "space-y-2"
            : `relative space-y-2 p-3 ${isMobile ? "rounded-md border border-[#2b2117]/80 bg-[#15100c] shadow-[0_14px_28px_rgba(6,4,2,0.45)]" : ""}`
        }
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
        <div
          className={
            inSheet ? "overflow-y-auto pr-1" : "min-h-[10rem] max-h-[12rem] overflow-y-auto pr-1"
          }
        >
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
                <StashItemRow
                  key={entry.id}
                  entry={entry}
                  canEdit={canEdit}
                  onMenuClick={(e) => menu.handleMenuToggle(entry, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <ItemActionDialogs menu={menu} canEdit={canEdit} menuInPlace={inSheet} />
    </>
  );
}
