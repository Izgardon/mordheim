import { useState, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { warbandLogsQuery } from "@/features/warbands/api/economy-queries";
import { markLedgerStale } from "@/features/warbands/api/warband-cache";
import { createWarbandLog } from "@/features/warbands/api/warbands-api";
import { useAppStore } from "@/stores/app-store";
import { capitalDice, rollDie as rollDieOf, type Dice } from "@/lib/dice";

const DICE = ["D3", "D6", "D8", "D10", "D12", "D20", "D66", "D100"] as const;
type Die = (typeof DICE)[number];

const random = rollDieOf;
/** One die: D66 is two D6 read as tens and units. */
const rollDie = (die: Die) =>
  die === "D66" ? random(6) * 10 + random(6) : random(Number(die.slice(1)));

type DicePanelProps = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, if this placement has one (the shell owns the open state). */
  trigger?: ReactNode;
};

/**
 * Quick rolls (design E): any number of D3 to D100 or D66, a modifier and a reason, rolled here or
 * typed into a box per die from the table's dice. Each roll goes into your warband's log as a dice
 * roll, and your recent rolls are listed underneath.
 */
export default function DicePanel({ campaignId, open, onOpenChange, trigger }: DicePanelProps) {
  const { warband } = useAppStore();
  const queryClient = useQueryClient();
  const [count, setCount] = useState(2);
  const [die, setDie] = useState<Die>("D6");
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState("");
  const [last, setLast] = useState<{ faces: number[]; total: number; dice: string } | null>(null);
  const [error, setError] = useState("");
  const logs = useInfiniteQuery({
    ...warbandLogsQuery(campaignId, warband?.id ?? 0, "dice_roll"),
    enabled: open && Boolean(warband),
  });
  const recent = (logs.data?.pages[0]?.results ?? []).slice(0, 8);
  const notation = `${count > 1 ? count : ""}${die}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`;

  /** A roll's faces, rolled here or typed in from the table, logged the same way. */
  const record = (faces: number[]) => {
    const total = faces.reduce((sum, face) => sum + face, 0) + modifier;
    setLast({ faces, total, dice: `${count}${die}` });
    setError("");
    if (!warband) return;
    const why = reason.trim();
    void createWarbandLog(warband.id, {
      feature: "dice_roll",
      entry_type: "dice_roll",
      payload: {
        warband: warband.name || "Warband",
        dice: notation,
        rolls: faces,
        total,
        ...(why ? { reason: why } : {}),
      },
    })
      .then(() => {
        markLedgerStale(queryClient, warband.id);
        void logs.refetch();
      })
      .catch(() => setError("Rolled, but the roll couldn't be logged."));
  };

  const roll = () => record(Array.from({ length: count }, () => rollDie(die)));
  // every roll can be typed in (William, 24 Nov 2026: yes, on the main roller too): a box per die;
  // a D66's two boxes make one result, so several D66 roll only
  const typeable: Dice | null =
    die === "D66" ? (count === 1 ? "D66" : null) : (`${count > 1 ? count : ""}${die}` as Dice);
  const fromBoxes = (faces: number[]) =>
    record(die === "D66" ? [(faces[0] ?? 0) * 10 + (faces[1] ?? 0)] : faces);

  const stepper = (label: string, value: string, onDown: () => void, onUp: () => void) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex items-center gap-1.5">
        <IconButton aria-label={`Lower ${label.toLowerCase()}`} className="w-10" onClick={onDown}>
          <Minus aria-hidden="true" />
        </IconButton>
        <span className="min-w-8 flex-1 text-center font-mono text-lg font-bold text-head">
          {value}
        </span>
        <IconButton aria-label={`Raise ${label.toLowerCase()}`} className="w-10" onClick={onUp}>
          <Plus aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );

  return (
    <>
      {trigger ? <Slot onClick={() => onOpenChange(true)}>{trigger}</Slot> : null}
      <SidePanel open={open} onOpenChange={onOpenChange} kicker="Table" title="Dice">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">Die</span>
          <div role="group" aria-label="Die" className="grid grid-cols-4 gap-1.5">
            {DICE.map((kind) => (
              <Chip
                key={kind}
                pressed={die === kind}
                onClick={() => setDie(kind)}
                className="min-h-11 justify-center font-mono"
              >
                {kind}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stepper(
            "Dice",
            String(count),
            () => setCount((n) => Math.max(1, n - 1)),
            () => setCount((n) => Math.min(20, n + 1))
          )}
          {stepper(
            "Modifier",
            modifier > 0 ? `+${modifier}` : String(modifier),
            () => setModifier((n) => n - 1),
            () => setModifier((n) => n + 1)
          )}
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
          What for
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        {typeable ? (
          // the boxes are the result (William, 24 Nov 2026: "doesn't need both the boxes and the
          // result boxes"): rolled or typed, the faces sit in them and the total beside them
          <DiceEntry
            key={typeable}
            dice={typeable}
            onFaces={fromBoxes}
            size="lg"
            className="[&>button]:w-full"
            boxesClassName="w-full border border-accent-line bg-surface p-3.5"
            beside={
              last && last.dice === `${count}${die}` ? (
                <span
                  aria-live="polite"
                  className="ml-auto font-display text-[28px] font-semibold text-accent-hi"
                >
                  {last.total}
                </span>
              ) : null
            }
            button={(rollBoxes) => (
              <Button size="lg" onClick={rollBoxes}>
                Roll {notation}
              </Button>
            )}
          />
        ) : (
          <Button size="lg" onClick={roll}>
            Roll {notation}
          </Button>
        )}
        {!typeable && last ? (
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 border border-accent-line bg-surface p-3.5"
          >
            {last.faces.map((face, index) => (
              <span
                key={index}
                className="flex h-11 min-w-11 items-center justify-center border border-strong px-1.5 font-mono text-xl font-bold text-head"
              >
                {face}
              </span>
            ))}
            <span className="ml-auto font-display text-[28px] font-semibold text-accent-hi">
              {last.total}
            </span>
          </div>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!warband ? (
          <p className="text-sm text-muted-foreground">Rolls are logged once you have a warband.</p>
        ) : recent.length ? (
          <section aria-label="Your rolls" className="flex flex-col">
            <h3 className="pb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              Your rolls
            </h3>
            {recent.map((entry) => {
              const payload = entry.payload ?? {};
              return (
                <div key={entry.id} className="flex items-baseline gap-3 border-t border-line py-2">
                  <span className="w-16 shrink-0 font-mono text-xs text-faint">
                    {capitalDice(String(payload.dice ?? ""))}
                  </span>
                  <span className="flex-1 text-[13px] text-text2">
                    {String(payload.reason ?? "")}
                  </span>
                  <span className="w-9 text-right font-mono text-sm font-bold text-head">
                    {String(payload.total ?? "")}
                  </span>
                </div>
              );
            })}
          </section>
        ) : null}
      </SidePanel>
    </>
  );
}
