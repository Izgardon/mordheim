import { createContext, useContext, useState } from "react";

/**
 * Who the warband's store last put an item on (William, 22 Nov 2026: the dropdown should remember
 * the last unit picked), shared by every item's Add to basket while the store is open; the stash
 * at first. Outside a store (a test, Wargear) each dropdown keeps its own.
 */
export type RecipientChoice = { key: string; set: (key: string) => void };

export const RecipientChoiceContext = createContext<RecipientChoice | null>(null);

/** The store's one choice, from its panel. */
export function useRecipientChoiceState(): RecipientChoice {
  const [key, set] = useState("stash");
  return { key, set };
}

/** The choice an item's dropdown starts from and writes back: the store's, else its own. */
export function useRecipientChoice(): RecipientChoice {
  const shared = useContext(RecipientChoiceContext);
  const own = useRecipientChoiceState();
  return shared ?? own;
}
