/** A hero who may search for a rare item, and whether their trading action is spent. */
export type SearchingHero = { id: number; name: string; spent: boolean };

/** Who searches: a hero, or No hero (id null). */
export type Searcher = { id: number | null; who: string };

export const NO_HERO: Searcher = { id: null, who: "No hero" };

/**
 * Who searches first: the hero the store was opened for, else the first hero whose trading action
 * is unspent (William, 22 Nov 2026), leaving out those who searched already; with every hero spent
 * the player picks, and a warband with no heroes searches as No hero.
 */
export function firstSearcher(
  props: { searchers: SearchingHero[]; firstHeroId: number | null },
  tried: (number | null)[]
): Searcher | null {
  const open = props.searchers.filter((hero) => !hero.spent && !tried.includes(hero.id));
  const hero = open.find((one) => one.id === props.firstHeroId) ?? open[0];
  if (hero) return { id: hero.id, who: hero.name };
  return props.searchers.length ? null : NO_HERO;
}
