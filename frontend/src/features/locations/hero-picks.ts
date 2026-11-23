import type { HeroCount } from "./types";

type Hero = { id: number; trading_action?: boolean | null };

/** The hero picked at first: the first whose trading action is unspent, else the first. */
export function firstPick(heroes: Hero[]): number[] {
  const ready = heroes.find((hero) => hero.trading_action !== false) ?? heroes[0];
  return ready ? [ready.id] : [];
}

/**
 * Whether the picked heroes fall outside the location's range ("all": every hero on the roster).
 * A warning beside Visit, never a block; the server words the warning it answers.
 */
export function outsideRange(
  range: { min_heroes: HeroCount; max_heroes: HeroCount },
  picked: number,
  roster: number
): boolean {
  const least = range.min_heroes === "all" ? roster : range.min_heroes;
  const most = range.max_heroes === "all" ? roster : range.max_heroes;
  return picked < least || picked > most;
}
