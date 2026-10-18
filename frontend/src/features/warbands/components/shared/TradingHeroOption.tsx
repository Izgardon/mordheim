import { SelectItem } from "@components/select";

/** What a hero who already traded or searched this round is shown with (decision 9). */
export const SPENT_HERO_NOTE = "used his trading action this round";

/** The warning once a spent hero is picked: the action still goes ahead (ECON-TWEAK-01). */
export const spentHeroWarning = (name: string) =>
  `${name} already used his trading action this round.`;

type TradingHeroOptionProps = {
  id: number | string;
  name: string;
  spent: boolean;
};

/**
 * A hero in a trading-action picker (the trade's trader, the rare-item searcher). A spent hero is
 * greyed out and says so, but stays selectable: the rules warn, they don't block.
 */
export function TradingHeroOption({ id, name, spent }: TradingHeroOptionProps) {
  return (
    <SelectItem
      value={String(id)}
      className={spent ? "text-muted-foreground opacity-70" : undefined}
    >
      {name}
      {spent ? ` (${SPENT_HERO_NOTE})` : ""}
    </SelectItem>
  );
}

/** The warning under a picker whose chosen hero is spent. */
export function SpentHeroWarning({ name }: { name: string }) {
  return (
    <p role="status" className="text-xs text-amber-300">
      {spentHeroWarning(name)}
    </p>
  );
}
