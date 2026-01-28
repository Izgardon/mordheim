import { Button } from "@components/button";
import { ScrollArea } from "@components/scroll-area";

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
          <h1 className="rpg-page-title text-lg md:text-2xl">{warband.name}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {warband.faction}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="border border-border/70 bg-muted/30 px-2 py-1">
              Gold crowns: <span className="text-foreground">{goldCrowns ?? 0}</span>
            </span>
            <span className="border border-border/70 bg-muted/30 px-2 py-1">
              Rating: <span className="text-foreground">{rating ?? 0}</span>
            </span>
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
                  <ScrollArea className="warchest-scroll">
                    <ul className="warchest-list">
                      {warchestItems.map((item) => (
                        <li key={item.id} className="warchest-item">
                          {item.name || "Unnamed item"}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
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
      <p className="text-xs font-semibold text-muted-foreground">warband</p>
      <h1 className="rpg-page-title text-lg md:text-2xl">Raise your banner</h1>
    </header>
  );
}
