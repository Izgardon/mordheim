import { useState } from "react";
import { Handshake } from "lucide-react";

import greedIcon from "@/assets/icons/greed.webp";
import ratingIcon from "@/assets/icons/Menu.webp";
import chestClosedIcon from "@/assets/icons/chest.webp";
import chestOpenIcon from "@/assets/icons/chest_open.webp";

import { Tooltip } from "@components/tooltip";
import TradeInviteDialog from "../trade/TradeInviteDialog";
import StashItemList from "./stash/StashItemList";
import WarbandRatingDialog from "./WarbandRatingDialog";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandItemSummary,
} from "../../types/warband-types";

type WarbandMobileMetaBarProps = {
  warbandId: number;
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
          <div className="warchest-anchor">
            <button
              type="button"
              onClick={onToggleWarchest}
              className="icon-button flex h-8 w-8 items-center justify-center border-none bg-transparent p-0"
              aria-pressed={isWarchestOpen}
              aria-label="Warband Stash"
            >
              <img
                src={isWarchestOpen ? chestOpenIcon : chestClosedIcon}
                alt=""
                className="h-6 w-6 object-contain"
              />
            </button>
            <section
              className={`warchest-float ${isWarchestOpen ? "is-open" : ""}`}
              aria-hidden={!isWarchestOpen}
            >
              <StashItemList
                items={warchestItems}
                warbandId={warbandId}
                isLoading={isWarchestLoading}
                error={warchestError}
                onClose={onCloseWarchest}
                onItemsChanged={onWarchestItemsChanged}
                onHeroUpdated={onHeroUpdated}
                canEdit={canEdit}
              />
            </section>
          </div>
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
