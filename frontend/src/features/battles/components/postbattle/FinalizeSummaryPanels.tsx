import type { ReactNode } from "react";

import { POSTBATTLE_SECTION_LABELS } from "@/features/battles/components/postbattle/PostbattleSection";
import type { FinalizeSummary } from "@/features/battles/components/postbattle/postbattle-summary";
import { cn } from "@/lib/utils";

type Line = { key: string; text: ReactNode; className?: string };

function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="battle-inline-panel p-4">
      <p className="battle-section-title">{title}</p>
      {children}
    </div>
  );
}

function SummaryLines({ lines, empty }: { lines: Line[]; empty?: string }) {
  if (lines.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {lines.map((line) => (
        <p key={line.key} className={cn("text-sm text-foreground", line.className)}>
          {line.text}
        </p>
      ))}
    </div>
  );
}

/** A panel only when it has lines (the sections finalise often has nothing for). */
function OptionalPanel({ title, lines }: { title: string; lines: Line[] }) {
  return lines.length > 0 ? (
    <SummaryPanel title={title}>
      <SummaryLines lines={lines} />
    </SummaryPanel>
  ) : null;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Every permanent change finalising applies (BATL-NEW-10), one panel per kind. */
export default function FinalizeSummaryPanels({
  summary,
  showUpkeep,
}: {
  summary: FinalizeSummary;
  showUpkeep: boolean;
}) {
  const findLines: Line[] = [
    ...(summary.findsGoldCrowns > 0
      ? [{ key: "gold", text: `${summary.findsGoldCrowns} gc will be added as a Reward trade.` }]
      : []),
    ...summary.findsItems.map((item, index) => ({
      key: `${item.item_id}-${index}`,
      text: `${item.name} will be added to the stash${item.cost !== null ? ` at ${item.cost} gc` : ""}.`,
    })),
  ];
  const statLines: Line[] = [
    ...summary.keptStatChanges.map((row) => ({
      key: `kept-${row.key}`,
      text: `${row.unitName} keeps ${row.changes.join(", ")}.`,
    })),
    ...summary.droppedStatChanges.map((row) => ({
      key: `dropped-${row.key}`,
      text: `${row.unitName}'s ${row.changes.join(", ")} ends with the battle.`,
      className: "text-muted-foreground",
    })),
  ];
  const { gold } = summary;
  return (
    <div className="space-y-4">
      <SummaryPanel title={POSTBATTLE_SECTION_LABELS.exploration}>
        <p className="mt-2 text-sm text-foreground">
          {summary.resourceName ? (
            <>
              You will gain {summary.resourceAmount}{" "}
              <span className="text-accent">{summary.resourceName}</span>.
            </>
          ) : (
            "No resource will be updated."
          )}
        </p>
      </SummaryPanel>
      <SummaryPanel title={POSTBATTLE_SECTION_LABELS.finds}>
        <SummaryLines lines={findLines} empty="No finds are currently set." />
      </SummaryPanel>
      <SummaryPanel title="Deaths">
        <SummaryLines
          lines={summary.deaths.map((row) => ({
            key: `death-${row.unitKey}`,
            text: `${row.unitName} will be marked dead.`,
          }))}
          empty="No units are marked dead."
        />
      </SummaryPanel>
      <OptionalPanel
        title="Items lost"
        lines={summary.itemsLost.map((row) => ({
          key: `lost-${row.unitKey}`,
          text: row.henchman
            ? `${row.unitName} takes one of each of his group's items with him: ${row.items.join(", ")}.`
            : `${row.unitName}'s ${row.items.join(", ")} ${row.items.length === 1 ? "is" : "are"} lost.`,
        }))}
      />
      <OptionalPanel
        title="Serious injuries"
        lines={summary.injuries.map((row) => ({
          key: `injury-${row.unitKey}`,
          text: row.byHand ? `${row.text}: apply by hand on the warband sheet.` : `${row.text}.`,
          className: row.byHand ? "text-amber-300" : undefined,
        }))}
      />
      <SummaryPanel title="XP Awards">
        <SummaryLines
          lines={summary.xpAwards.map((row) => ({
            key: `xp-${row.unitKey}`,
            text: `${row.unitName} will gain ${row.xpEarned} XP.`,
          }))}
          empty="No XP awards are currently set."
        />
      </SummaryPanel>
      <OptionalPanel
        title="Level-ups"
        lines={summary.levelUps.map((row) => ({
          key: `level-${row.key}`,
          text: `${row.unitName} reaches ${row.levelUps === 1 ? "a level-up" : plural(row.levelUps, "level-up")}${row.xpFrom !== undefined ? ` (XP ${row.xpFrom} → ${row.xpTo})` : ""}.`,
        }))}
      />
      <OptionalPanel
        title="Kills"
        lines={summary.kills.map((row) => ({
          key: `kills-${row.unitKey}`,
          text: `${row.unitName} took out ${row.victims.join(", ")}.`,
        }))}
      />
      <OptionalPanel title="Stat changes" lines={statLines} />
      <OptionalPanel
        title="Items used"
        lines={summary.itemsUsed.map((row) => ({
          key: `used-${row.key}`,
          text: `${row.unitName}'s ${row.itemName} is used up.`,
        }))}
      />
      {showUpkeep ? (
        <SummaryPanel title={POSTBATTLE_SECTION_LABELS.upkeep}>
          {summary.payUpkeep ? (
            <p className="mt-2 text-sm text-foreground">
              You will be paying {summary.upkeepTotal}gc in upkeep.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Pay upkeep is unchecked, so no Upkeep trade entry will be created.
            </p>
          )}
        </SummaryPanel>
      ) : null}
      {gold ? (
        <SummaryPanel title="Gold">
          <p className="mt-2 text-sm text-foreground">
            {gold.current} gc now
            {gold.findsGoldCrowns > 0 ? `, +${gold.findsGoldCrowns} gc found` : ""}
            {gold.upkeepPaid > 0 ? `, -${gold.upkeepPaid} gc upkeep` : ""}:{" "}
            <span className={cn("font-semibold", gold.after < 0 && "text-red-500")}>
              {gold.after} gc
            </span>{" "}
            after this battle.
          </p>
        </SummaryPanel>
      ) : null}
    </div>
  );
}
