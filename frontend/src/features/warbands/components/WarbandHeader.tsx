import { Button } from "@components/button";
import { Tooltip } from "@/components/ui/tooltip";

import numberBox from "@/assets/containers/number_box.png";
import greedIcon from "@/assets/icons/greed.png";
import fightIcon from "@/assets/icons/Fight.png";

import type { Warband } from "../types/warband-types";

type WarbandHeaderProps = {
  warband: Warband | null;
  goldCrowns?: number;
  rating?: number;
  onOpenWarchest?: () => void;
  isWarchestOpen?: boolean;
  warchestItems?: { id: number; name: string }[];
  isWarchestLoading?: boolean;
  warchestError?: string;
  onCloseWarchest?: () => void;
};

export default function WarbandHeader({
  warband,
  goldCrowns,
  rating,
  onOpenWarchest,
  isWarchestOpen = false,
  warchestItems = [],
  isWarchestLoading = false,
  warchestError = "",
  onCloseWarchest,
}: WarbandHeaderProps) {
  if (warband) {
    return (
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-1 flex-col items-start text-left">
          <h1 className=" text-lg md:text-2xl">{warband.name}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {warband.faction}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Tooltip
              trigger={
                <div
                  className="flex h-12 w-24 cursor-pointer items-center justify-start gap-2 bg-cover bg-center bg-no-repeat pl-3 font-bold"
                  style={{ backgroundImage: `url(${numberBox})`, color: '#feb422' }}
                >
                  <img src={greedIcon} alt="" className="h-5 w-5" />
                  <span>{goldCrowns ?? 0}</span>
                </div>
              }
              content="Gold Coins"
              minWidth={120}
              maxWidth={200}
            />
            <Tooltip
              trigger={
                <div
                  className="flex h-12 w-24 cursor-pointer items-center justify-start gap-2 bg-cover bg-center bg-no-repeat pl-3 font-bold text-foreground"
                  style={{ backgroundImage: `url(${numberBox})` }}
                >
                  <img src={fightIcon} alt="" className="h-5 w-5" />
                  <span>{rating ?? 0}</span>
                </div>
              }
              content="Warband Rating"
              minWidth={120}
              maxWidth={200}
            />
          </div>
        </div>
        {onOpenWarchest ? (
          <div className="warchest-anchor">
            <Button type="button" variant="secondary" size="sm" onClick={onOpenWarchest}>
              Warchest
            </Button>
            <section
              className={`warchest-float ${isWarchestOpen ? "is-open" : ""}`}
              aria-hidden={!isWarchestOpen}
            >
              <div className="warchest-header">
                <div>
                  <p className="warchest-kicker">Warchest</p>
                  <h2 className="warchest-title">{warband.name}</h2>
                </div>
                <button
                  type="button"
                  className="warchest-close"
                  onClick={onCloseWarchest}
                >
                  ×
                </button>
              </div>
              <div className="warchest-body">
                {isWarchestLoading ? (
                  <p className="warchest-muted">Loading items...</p>
                ) : warchestError ? (
                  <p className="warchest-error">{warchestError}</p>
                ) : warchestItems.length === 0 ? (
                  <p className="warchest-muted">No items in the warchest yet.</p>
                ) : (
                  <div className="warchest-scroll">
                    <ul className="warchest-list">
                      {warchestItems.map((item) => (
                        <li key={item.id} className="warchest-item">
                          {item.name || "Unnamed item"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header className="text-left">
      <h1 className=" text-lg md:text-2xl font-bold" style={{ color: '#a78f79' }}>RAISE YOUR BANNER</h1>
    </header>
  );
}
