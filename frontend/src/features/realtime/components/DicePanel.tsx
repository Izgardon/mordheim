import { useState, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { warbandLogsQuery } from "@/features/warbands/api/economy-queries";
import { markLedgerStale } from "@/features/warbands/api/warband-cache";
import { createWarbandLog } from "@/features/warbands/api/warbands-api";
import { useAppStore } from "@/stores/app-store";
import { capitalDice, rollDie as rollDieOf } from "@/lib/dice";

const DICE = ["D3", "D6", "D8", "D10", "D12", "D20", "D66", "D100"] as const;
type Die = (typeof DICE)[number];
const PRESETS: { label: string; count: number; die: Die }[] = [
  { label: "D6", count: 1, die: "D6" },
  { label: "2D6", count: 2, die: "D6" },
  { label: "D3", count: 1, die: "D3" },
  { label: "D66", count: 1, die: "D66" },
  { label: "3D6", count: 3, die: "D6" },
];

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
 * Quick rolls (design E): any number of D3 to D100 or D66, a modifier and a reason. Each roll goes
 * into your warband's log as a dice roll, and your recent rolls are listed underneath.
 */
export default function DicePanel({ campaignId, open, onOpenChange, trigger }: DicePanelProps) {
  const { warband } = useAppStore();
  const queryClient = useQueryClient();
  const [count, setCount] = useState(2);
  const [die, setDie] = useState<Die>("D6");
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState("");
  const [last, setLast] = useState<{ faces: number[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const logs = useInfiniteQuery({
    ...warbandLogsQuery(campaignId, warband?.id ?? 0, "dice_roll"),
    enabled: open && Boolean(warband),
  });
  const recent = (logs.data?.pages[0]?.results ?? []).slice(0, 8);
  const notation = `${count > 1 ? count : ""}${die}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`;

  const roll = () => {
    const faces = Array.from({ length: count }, () => rollDie(die));
    const total = faces.reduce((sum, face) => sum + face, 0) + modifier;
    setLast({ faces, total });
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
        <div role="group" aria-label="Quick rolls" className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              pressed={count === preset.count && die === preset.die && modifier === 0}
              onClick={() => {
                setCount(preset.count);
                setDie(preset.die);
                setModifier(0);
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
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
        <Button size="lg" onClick={roll}>
          Roll {notation}
        </Button>
        {last ? (
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
