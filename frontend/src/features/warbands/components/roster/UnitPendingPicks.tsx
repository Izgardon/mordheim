import { ChipLabel } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import { BADGE } from "./badge-style";
import { usePrays } from "./spell-sections";
import { waitingPicks, type PendingList, type RosterUnit } from "./unit-view";

const NOUN: Record<PendingList, [string, string]> = {
  skills: ["skill", "skills"],
  spells: ["spell", "spells"],
  specials: ["special", "specials"],
};
const PRAYER: [string, string] = ["prayer", "prayers"];

/** Opens the card on the box of the unit's first pick on `list`. */
export type OnPendingPick = (list: PendingList) => void;

/**
 * The closed card's badge for the picks an advance left for later, in the open card's words
 * ("Skill to choose"): "2 skills to choose", or "To choose: 1 skill, 1 spell" over several lists;
 * a priest's spells are prayers. Null with none.
 */
export function pendingPicksText(entry: RosterUnit, prays = false) {
  const waiting = waitingPicks(entry);
  const nouns = (list: PendingList) => (list === "spells" && prays ? PRAYER : NOUN[list]);
  const words = ({ list, count }: (typeof waiting)[number]) =>
    `${count} ${nouns(list)[count === 1 ? 0 : 1]}`;
  if (!waiting.length) return null;
  if (waiting.length > 1) return `To choose: ${waiting.map(words).join(", ")}`;
  const [only] = waiting;
  if (only.count > 1) return `${words(only)} to choose`;
  const [noun] = nouns(only.list);
  return `${noun[0].toUpperCase()}${noun.slice(1)} to choose`;
}

/**
 * A closed card's badge for the picks waiting (William, 28 Nov 2026: "when a unit has a spell or
 * skill or special to choose can we make it clear on their minimised card"), the badges' chip in
 * the accent; for whoever edits the warband, pressing it opens the card at the first pick's box.
 */
export default function UnitPendingPicks({
  entry,
  campaignId,
  onPick,
  line = false,
}: {
  entry: RosterUnit;
  campaignId: number;
  /** On a line of its own (a hired sword's, whose badges sit in his head). */
  line?: boolean;
  /** None: the badge only labels. */
  onPick?: OnPendingPick;
}) {
  const prays = usePrays(entry, campaignId);
  const text = pendingPicksText(entry, prays);
  if (!text) return null;
  const chip = (
    <ChipLabel tone="accent" className={cn(BADGE, onPick && "group-hover:border-primary")}>
      {text}
    </ChipLabel>
  );
  const badge = onPick ? (
    <button
      type="button"
      className="group inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onPick(waitingPicks(entry)[0].list)}
    >
      {chip}
    </button>
  ) : (
    chip
  );
  return line ? <div className="flex">{badge}</div> : badge;
}
