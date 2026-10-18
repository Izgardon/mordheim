import { payloadOf, renderDiceBadge, type LogFormatter } from "./badges";

type LogRoll = { dice?: string; result?: { total?: number } };
// `{ id, label }` from the current level-up flows; older entries stored the label string itself.
type LogAdvance = string | { id?: string; label?: string };

type UnitAdvancePayload = {
  hero?: string;
  advance?: LogAdvance;
  roll1?: LogRoll;
  roll2?: LogRoll;
};

type HenchmenAdvancePayload = {
  group?: string;
  advance?: LogAdvance;
  roll1?: LogRoll;
};

// The object's label, else the stored value itself, else "Advance". Primitives have no `label`,
// so this matches the untyped `advance?.label || advance || "Advance"` read for every input.
const getAdvanceLabel = (advance: LogAdvance | undefined): string =>
  (typeof advance === "object" ? advance?.label : undefined) ||
  (advance as string | undefined) ||
  "Advance";

/** A hero's or hired sword's level-up, with up to two rolls; `unknownName` names a missing unit. */
const unitAdvance =
  (unknownName: string): LogFormatter =>
  (log) => {
    const payload = payloadOf<UnitAdvancePayload>(log);
    const heroName = payload.hero || unknownName;
    const advanceLabel = getAdvanceLabel(payload.advance);
    const roll1Total = payload.roll1?.result?.total ?? null;
    const roll2Total = payload.roll2?.result?.total ?? null;
    const roll1Dice = payload.roll1?.dice;
    const roll2Dice = payload.roll2?.dice;

    if (roll1Total === null && roll2Total === null) {
      return `${heroName} levelled up and gained a ${advanceLabel}`;
    }
    if (roll2Total === null) {
      return (
        <>
          {heroName} levelled up with a roll of {roll1Total} ({renderDiceBadge(roll1Dice)}) and
          gained a {advanceLabel}
        </>
      );
    }
    return (
      <>
        {heroName} levelled up with a roll of {roll1Total} ({renderDiceBadge(roll1Dice)}), followed
        by a {roll2Total} ({renderDiceBadge(roll2Dice)}) and gained a {advanceLabel}
      </>
    );
  };

const henchmenAdvance: LogFormatter = (log) => {
  const payload = payloadOf<HenchmenAdvancePayload>(log);
  const groupName = payload.group || "Unknown Group";
  const advanceLabel = getAdvanceLabel(payload.advance);
  const roll1Total = payload.roll1?.result?.total ?? null;
  const roll1Dice = payload.roll1?.dice;

  if (roll1Total === null) {
    return `${groupName} levelled up and gained ${advanceLabel}`;
  }
  return (
    <>
      {groupName} levelled up with a roll of {roll1Total} ({renderDiceBadge(roll1Dice)}) and gained{" "}
      {advanceLabel}
    </>
  );
};

/** Level-ups of each unit kind. */
export const ADVANCE_FORMATTERS: Record<string, LogFormatter> = {
  "advance:hero": unitAdvance("Unknown Hero"),
  "advance:henchmen": henchmenAdvance,
  "advance:hired_sword": unitAdvance("Unknown Hired Sword"),
};
