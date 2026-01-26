import type { Warband } from "../types/warband-types";

type WarbandHeaderProps = {
  warband: Warband | null;
};

export default function WarbandHeader({ warband }: WarbandHeaderProps) {
  if (warband) {
    return (
      <header>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          {warband.name}
          <span className="text-base text-muted-foreground"> - {warband.faction}</span>
        </h1>
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
