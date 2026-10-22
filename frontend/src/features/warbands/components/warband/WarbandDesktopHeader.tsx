import { useState } from "react";
import { BookOpen, Handshake } from "lucide-react";

import { Button } from "@components/button";
import { PageSubnav } from "@/components/ui/page-subnav";
import greedIcon from "@/assets/icons/greed.webp";
import ratingIcon from "@/assets/icons/Menu.webp";
import GoldLabel from "./GoldLabel";
import HeaderIconButton from "./HeaderIconButton";
import StashItemList from "./stash/StashItemList";
import WarbandPdfViewerDialog from "./WarbandPdfViewerDialog";
import WarbandRatingDialog from "./WarbandRatingDialog";
import WarbandRecordIndicator from "./WarbandRecordIndicator";
import TradeInviteDialog from "../trade/TradeInviteDialog";
import { ChestClosedIcon, ChestOpenIcon } from "./chest-icons";

import { WARBAND_TABS, type WarbandTab } from "../../hooks/warband/useWarbandPage";

import type { ComponentProps } from "react";
import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHireling,
} from "../../types/warband-types";

const transparentButton =
  "min-[960px]:bg-transparent min-[960px]:hover:bg-transparent min-[960px]:focus-visible:bg-transparent min-[960px]:data-[active=true]:bg-transparent";

/** The stash list's data and the open/close toggle, shared by both page headers. */
export type WarbandStashControls = Omit<
  ComponentProps<typeof StashItemList>,
  "warbandId" | "canEdit" | "inSheet"
> & {
  isOpen: boolean;
  onToggle: () => void;
};

type WarbandDesktopHeaderProps = {
  warband: Warband;
  activeTab: WarbandTab;
  onTabChange: (tabId: string) => void;
  /** Gold the open edit session will spend on Save (queued recruits and purchases). */
  pendingGold?: number;
  warbandRating: number;
  heroes: WarbandHero[];
  hirelings: WarbandHireling[];
  henchmenGroups: HenchmenGroup[];
  stash: WarbandStashControls;
  /** The sheet's `manage_items` capability: the stash's item menus. */
  canManageItems: boolean;
  canInitiateTrade: boolean;
  campaignId: number;
  userId?: number;
  onCreateTradeRequest: ComponentProps<typeof TradeInviteDialog>["onCreateTradeRequest"];
};

/** The desktop page header: name, tabs, record, gold, rating, stash, trade and sheet. */
export default function WarbandDesktopHeader({
  warband,
  activeTab,
  onTabChange,
  pendingGold = 0,
  warbandRating,
  heroes,
  hirelings,
  henchmenGroups,
  stash: { isOpen: isStashOpen, onToggle: onToggleStash, ...stash },
  canManageItems,
  canInitiateTrade,
  campaignId,
  userId,
  onCreateTradeRequest,
}: WarbandDesktopHeaderProps) {
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  return (
    <PageSubnav
      className="overflow-visible"
      title={warband.name}
      subtitle={warband.faction}
      tabs={WARBAND_TABS}
      activeTab={activeTab}
      onTabChange={onTabChange}
      meta={
        <>
          <WarbandRecordIndicator
            wins={warband.wins}
            losses={warband.losses}
            triggerClassName={transparentButton}
          />
          <HeaderIconButton
            icon={greedIcon}
            label={<GoldLabel gold={warband.gold ?? 0} pending={pendingGold} />}
            tooltip={pendingGold > 0 ? "Gold coins left after Save" : "Gold coins"}
            ariaLabel="Gold coins"
            buttonClassName={`${transparentButton}${pendingGold > 0 ? " !w-auto" : ""}`}
          />
          <HeaderIconButton
            icon={ratingIcon}
            label={warbandRating}
            tooltip="Warband rating"
            ariaLabel="Warband rating"
            onClick={() => setIsRatingOpen(true)}
            buttonClassName={`border-0 ${transparentButton}`}
          />
          <WarbandRatingDialog
            open={isRatingOpen}
            onOpenChange={setIsRatingOpen}
            heroes={heroes}
            hirelings={hirelings}
            henchmenGroups={henchmenGroups}
          />
        </>
      }
      actions={
        <>
          <div className="relative">
            <Button
              type="button"
              variant="toolbar"
              className="h-9 gap-2 px-3 text-xs"
              onClick={onToggleStash}
              aria-label="Warband stash"
            >
              {isStashOpen ? (
                <ChestOpenIcon className="h-4 w-4" />
              ) : (
                <ChestClosedIcon className="h-4 w-4" />
              )}
              <span>Stash</span>
            </Button>
            <section
              className={`warchest-float ${isStashOpen ? "is-open" : ""}`}
              aria-hidden={!isStashOpen}
            >
              <StashItemList {...stash} warbandId={warband.id} canEdit={canManageItems} />
            </section>
          </div>
          {canInitiateTrade ? (
            <TradeInviteDialog
              campaignId={campaignId}
              currentUserId={userId}
              onCreateTradeRequest={onCreateTradeRequest}
              trigger={
                <Button
                  type="button"
                  variant="toolbar"
                  className="h-9 gap-2 px-3 text-xs"
                  aria-label="Start trade"
                >
                  <Handshake className="h-4 w-4" aria-hidden="true" />
                  <span>Trade</span>
                </Button>
              }
            />
          ) : null}
          {warband.warband_link ? (
            <>
              <Button
                type="button"
                variant="toolbar"
                className="h-9 gap-2 px-3 text-xs"
                onClick={() => setIsPdfOpen(true)}
                aria-label="View warband link"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>Sheet</span>
              </Button>
              <WarbandPdfViewerDialog
                open={isPdfOpen}
                onOpenChange={setIsPdfOpen}
                url={warband.warband_link}
                title={warband.name}
              />
            </>
          ) : null}
        </>
      }
    />
  );
}
