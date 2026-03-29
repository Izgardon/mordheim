import { useState } from "react";
import { BookOpen, Handshake } from "lucide-react";

import greedIcon from "@/assets/icons/greed.webp";
import ratingIcon from "@/assets/icons/Menu.webp";

function ChestClosedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="12" width="20" height="9" rx="1" />
      <rect x="2" y="5" width="20" height="7" rx="2" />
      <rect x="10" y="10.5" width="4" height="3" rx="1" />
    </svg>
  );
}

function ChestOpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="12" width="20" height="9" rx="1" />
      <path d="M2 12 L4 4 L20 4 L22 12" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

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
    <section className="relative z-[30] rounded-xl border border-[#2b2117]/80 bg-[#0b0a08]/70 px-4 py-3 shadow-[0_12px_30px_rgba(6,4,2,0.35)] backdrop-blur">
      <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[#e9dcc2]">
        <div className="flex items-center gap-4">
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
                className="icon-button flex h-8 w-8 items-center justify-center border-none bg-transparent p-0"
                aria-label="View warband PDF"
              >
                <BookOpen className="h-5 w-5 text-[#c9b48a]" aria-hidden="true" />
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
                  className="icon-button flex h-8 w-8 items-center justify-center border-none bg-transparent p-0"
                  aria-label="Start trade"
                >
                  <Handshake className="h-5 w-5 text-[#c9b48a]" aria-hidden="true" />
                </button>
              }
            />
          ) : null}
          <button
            type="button"
            onClick={onToggleWarchest}
            className="icon-button flex h-8 w-8 items-center justify-center border-none bg-transparent p-0"
            aria-pressed={isWarchestOpen}
            aria-label="Warband Stash"
          >
            {isWarchestOpen
              ? <ChestOpenIcon className="h-5 w-5 text-[#c9b48a]" />
              : <ChestClosedIcon className="h-5 w-5 text-[#c9b48a]" />
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
