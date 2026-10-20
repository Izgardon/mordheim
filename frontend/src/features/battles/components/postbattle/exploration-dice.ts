/** How many exploration dice can be rolled and chosen when the server's `rules` aren't known. */
export const DEFAULT_EXPLORATION_DICE = { max: 10, max_chosen: 6 };

export type ExplorationDiceLimits = typeof DEFAULT_EXPLORATION_DICE;
