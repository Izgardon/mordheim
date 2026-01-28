import { Button } from "@components/button";

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
        <div>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            {warband.name}
            <span className="text-base text-muted-foreground"> - {warband.faction}</span>
          </h1>
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
                  <ul className="warchest-list">
                    {warchestItems.map((item) => (
                      <li key={item.id} className="warchest-item">
                        {item.name || "Unnamed item"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header>
      <p className="text-xs font-semibold text-muted-foreground">warband</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Raise your banner</h1>
    </header>
  );
}
