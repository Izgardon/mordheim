import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { capitalDice } from "@/lib/dice";

import { DICE, type DiceRollerState } from "../hooks/useDiceRoller";

const stepper = (label: string, value: string, onDown: () => void, onUp: () => void) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs font-bold text-muted-foreground">{label}</span>
    <div
      role="group"
      aria-label={label}
      data-no-sheet-drag=""
      className="flex items-center gap-1.5"
    >
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

/**
 * Quick rolls (design E): any number of D3 to D100 or D66, a modifier and a reason, rolled here or
 * typed into a box per die from the table's dice, and your recent rolls underneath; its state is
 * `useDiceRoller`'s, held by the panel that places it (`DicePanel`).
 */
export default function DiceRoller({ roller }: { roller: DiceRollerState }) {
  const { last } = roller;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">Die</span>
        <div role="group" aria-label="Die" className="grid grid-cols-4 gap-1.5">
          {DICE.map((kind) => (
            <Chip
              key={kind}
              pressed={roller.die === kind}
              onClick={() => roller.setDie(kind)}
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
          String(roller.count),
          () => roller.setCount((n) => Math.max(1, n - 1)),
          () => roller.setCount((n) => Math.min(20, n + 1))
        )}
        {stepper(
          "Modifier",
          roller.modifier > 0 ? `+${roller.modifier}` : String(roller.modifier),
          () => roller.setModifier((n) => n - 1),
          () => roller.setModifier((n) => n + 1)
        )}
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground">
        What for
        <Input value={roller.reason} onChange={(event) => roller.setReason(event.target.value)} />
      </label>
      {roller.typeable ? (
        // the boxes are the result (William, 24 Nov 2026: "doesn't need both the boxes and the
        // result boxes"): rolled or typed, the faces sit in them and the total beside them
        <DiceEntry
          key={roller.typeable}
          dice={roller.typeable}
          onFaces={roller.fromBoxes}
          size="lg"
          className="[&>button]:w-full"
          boxesClassName="w-full border border-accent-line bg-surface p-3.5"
          beside={
            last && last.dice === `${roller.count}${roller.die}` ? (
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
              Roll {roller.notation}
            </Button>
          )}
        />
      ) : (
        <Button size="lg" onClick={roller.roll}>
          Roll {roller.notation}
        </Button>
      )}
      {!roller.typeable && last ? (
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
      {roller.error ? <p className="text-sm text-danger">{roller.error}</p> : null}
      {!roller.hasWarband ? (
        <p className="text-sm text-muted-foreground">Rolls are logged once you have a warband.</p>
      ) : roller.recent.length ? (
        <section aria-label="Your rolls" className="flex flex-col">
          <h3 className="pb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Your rolls
          </h3>
          {roller.recent.map((entry) => {
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
    </>
  );
}
