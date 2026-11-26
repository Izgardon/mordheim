import { createContext, useContext } from "react";

/**
 * How the catalogue pages name an entry of the campaign's own. A workshop is a player's own hidden
 * campaign, so there they are his own (William, 26 Nov 2026): its layout provides `WORKSHOP_WORDS`,
 * and every other page reads the campaign's.
 */
export type OwnWords = {
  /** Where its own entries live, opening a line or as a Setting: "This campaign". */
  Place: string;
  /** The same inside a line: "goes from this campaign". */
  place: string;
  /** Before an entry's name: "this campaign's Warhorse". */
  whose: string;
  /** A match's source tag after its name: "Warhorse · this campaign". */
  tag: string;
  /** An entry's Source: "This campaign's own". */
  own: string;
};

export const CAMPAIGN_WORDS: OwnWords = {
  Place: "This campaign",
  place: "this campaign",
  whose: "this campaign's",
  tag: "this campaign",
  own: "This campaign's own",
};

export const WORKSHOP_WORDS: OwnWords = {
  Place: "Your workshop",
  place: "your workshop",
  whose: "your",
  tag: "yours",
  own: "Your own",
};

export const OwnWordsContext = createContext<OwnWords>(CAMPAIGN_WORDS);

/** The words for the campaign's own entries where this page is: a workshop's, else a campaign's. */
export const useOwnWords = () => useContext(OwnWordsContext);
