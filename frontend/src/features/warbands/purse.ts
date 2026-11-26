import { createContext, useContext } from "react";

/**
 * What a warband spends from, as the store and the recruit tally name it: its Gold in a campaign,
 * its Budget in a workshop (apps/workshop: what is left of the budget after the roster's cost).
 */
export type Purse = "Gold" | "Budget";

export const PurseContext = createContext<Purse>("Gold");

export const usePurse = () => useContext(PurseContext);
