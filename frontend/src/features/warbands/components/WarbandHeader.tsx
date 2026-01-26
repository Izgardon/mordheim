import type { Warband } from "../types/warband-types";

type WarbandHeaderProps = {
  warband: Warband | null;
  goldCrowns?: number;
  rating?: number;
};

export default function WarbandHeader({ warband, goldCrowns, rating }: WarbandHeaderProps) {
  if (warband) {
    return (
      <header>
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
