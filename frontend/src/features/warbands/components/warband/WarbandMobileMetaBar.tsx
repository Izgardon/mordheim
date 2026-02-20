import { Handshake } from "lucide-react";

import greedIcon from "@/assets/icons/greed.webp";
import fightIcon from "@/assets/icons/Fight.webp";
import chestClosedIcon from "@/assets/icons/chest.webp";
import chestOpenIcon from "@/assets/icons/chest_open.webp";

import TradeInviteDialog from "../trade/TradeInviteDialog";
import StashItemList from "./stash/StashItemList";

import type { WarbandHero, WarbandItemSummary } from "../../types/warband-types";

type WarbandMobileMetaBarProps = {
  warbandId: number;
  tradeTotal: number;
  warbandRating: number;
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
  return (
    <section className="relative z-[30] rounded-xl border border-[#2b2117]/80 bg-[#0b0a08]/70 px-4 py-3 shadow-[0_12px_30px_rgba(6,4,2,0.35)] backdrop-blur">
      <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[#e9dcc2]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={greedIcon} alt="" className="h-4 w-4" />
            <span>{tradeTotal}</span>
          </div>
          <div className="flex items-center gap-2">
            <img src={fightIcon} alt="" className="h-4 w-4" />
            <span>{warbandRating}</span>
          </div>
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
    </section>
  );
}
