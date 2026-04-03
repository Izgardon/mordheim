import { useState } from "react";
import { BookOpen, Handshake } from "lucide-react";

import greedIcon from "@/assets/icons/greed.webp";
import ratingIcon from "@/assets/icons/Menu.webp";
import { ChestClosedIcon, ChestOpenIcon } from "./chest-icons";
import WarbandRecordIndicator from "./WarbandRecordIndicator";

import { Tooltip } from "@components/tooltip";
import TradeInviteDialog from "../trade/TradeInviteDialog";
import StashItemList from "./stash/StashItemList";
import WarbandRatingDialog from "./WarbandRatingDialog";
import WarbandPdfViewerDialog from "./WarbandPdfViewerDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemSummary,
} from "../../types/warband-types";

type WarbandMobileMetaBarProps = {
  warbandId: number;
  warbandLink?: string | null;
  warbandName?: string;
  wins?: number | null;
  losses?: number | null;
  tradeTotal: number;
  warbandRating: number;
  heroes: WarbandHero[];
  hiredSwords: WarbandHiredSword[];
  henchmenGroups: HenchmenGroup[];
  canEdit: boolean;
  canInitiateTrade: boolean;
  campaignId: number;
  userId: number | undefined;
  isWarchestOpen: boolean;
  isWarchestLoading: boolean;
  warchestItems: WarbandItemSummary[];
  warchestError: string;
  onToggleWarchest: () => void;
  onCloseWarchest: () => void;
  onWarchestItemsChanged: () => void;
  onHeroUpdated: (hero: WarbandHero) => void;
  onCreateTradeRequest: (targetUserId: number) => Promise<void>;
};

export default function WarbandMobileMetaBar({
  warbandId,
  warbandLink,
  warbandName,
  wins,
  losses,
  tradeTotal,
  warbandRating,
  heroes,
  hiredSwords,
  henchmenGroups,
  canEdit,
  canInitiateTrade,
  campaignId,
  userId,
  isWarchestOpen,
  isWarchestLoading,
  warchestItems,
  warchestError,
  onToggleWarchest,
  onCloseWarchest,
  onWarchestItemsChanged,
  onHeroUpdated,
  onCreateTradeRequest,
}: WarbandMobileMetaBarProps) {
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  return (
    <section className="surface-panel-strong relative z-[30] rounded-xl px-4 py-3 backdrop-blur">
      <div className="theme-icon-soft flex items-center justify-between gap-4 text-xs font-semibold">
        <div className="flex items-center gap-4">
          <WarbandRecordIndicator wins={wins} losses={losses} variant="mobile" />
          <Tooltip
            trigger={
              <div className="flex items-center gap-2">
                <img src={greedIcon} alt="" className="h-4 w-4" />
                <span>{tradeTotal}</span>
              </div>
            }
            content="Gold coins"
            maxWidth={200}
          />
          <button
            type="button"
            onClick={() => setIsRatingOpen(true)}
            className="icon-button flex items-center gap-2 border-none bg-transparent p-0"
            aria-label="Warband rating breakdown"
          >
            <img src={ratingIcon} alt="" className="h-4 w-4" />
            <span>{warbandRating}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {warbandLink ? (
            <>
              <button
                type="button"
                onClick={() => setIsPdfOpen(true)}
                className="btn-icon icon-button inline-flex h-8 w-8 items-center justify-center border p-0"
                aria-label="View warband link"
              >
                <BookOpen className="theme-icon-soft h-5 w-5" aria-hidden="true" />
              </button>
              <WarbandPdfViewerDialog
                open={isPdfOpen}
                onOpenChange={setIsPdfOpen}
                url={warbandLink}
                title={warbandName}
              />
            </>
          ) : null}
          {canInitiateTrade ? (
            <TradeInviteDialog
              campaignId={campaignId}
              currentUserId={userId}
              onCreateTradeRequest={onCreateTradeRequest}
              trigger={
                <button
                  type="button"
                  className="btn-icon icon-button inline-flex h-8 w-8 items-center justify-center border p-0"
                  aria-label="Start trade"
                >
                  <Handshake className="theme-icon-soft h-5 w-5" aria-hidden="true" />
                </button>
              }
            />
          ) : null}
          <button
            type="button"
            onClick={onToggleWarchest}
            className="btn-icon icon-button inline-flex h-8 w-8 items-center justify-center border p-0"
            data-active={isWarchestOpen ? "true" : undefined}
            aria-pressed={isWarchestOpen}
            aria-label="Warband Stash"
          >
            {isWarchestOpen
              ? <ChestOpenIcon className="theme-icon-soft h-5 w-5" />
              : <ChestClosedIcon className="theme-icon-soft h-5 w-5" />
            }
          </button>
          <Dialog open={isWarchestOpen} onOpenChange={(open) => { if (!open) onCloseWarchest(); }}>
            <DialogContent innerClassName="gap-4">
              <DialogHeader>
                <DialogTitle>Warband Stash</DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <StashItemList
                items={warchestItems}
                warbandId={warbandId}
                isLoading={isWarchestLoading}
                error={warchestError}
                onClose={onCloseWarchest}
                onItemsChanged={onWarchestItemsChanged}
                onHeroUpdated={onHeroUpdated}
                canEdit={canEdit}
                inSheet
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <WarbandRatingDialog
        open={isRatingOpen}
        onOpenChange={setIsRatingOpen}
        heroes={heroes}
        hiredSwords={hiredSwords}
        henchmenGroups={henchmenGroups}
      />
    </section>
  );
}
