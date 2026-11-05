import { Dices } from "lucide-react";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { cn } from "@/lib/utils";

import { feeGold, feeOf, matchCounter, type Fee } from "../../fees";
import {
  counterOf,
  lineWarning,
  type Counter,
  type Payment,
  type PaymentLine,
} from "./fee-payment";

const ADD = "add";
const NONE = "none";
const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

type FeePaymentProps = {
  fee: Fee | null | undefined;
  payment: Payment;
  onChange: (next: Payment) => void;
  /** The warband's resources, which pay the fee's resource lines. */
  counters: Counter[];
  /** "Add <name>": the new counter (at 0), or undefined when it couldn't be made. */
  onAddCounter: (name: string) => Promise<Counter | undefined>;
  /** Tells one payment's inputs from another's ("hire", "upkeep-12"). */
  idPrefix: string;
  /** Camp's rows: smaller, no headings. */
  compact?: boolean;
};

/**
 * What is paid for a fee (the fees step), every part prefilled and editable: the gold (Roll for its
 * dice, rerollable, or the dice typed in, fills the gold) and each resource line's amount, paid
 * from a counter of the warband's (the one of its name to start, another, a new one, or not at
 * all). A counter short of the amount warns and offers to pay what it holds: a guide, never a block.
 */
export default function FeePayment(props: FeePaymentProps) {
  const { payment, onChange, counters, idPrefix, compact } = props;
  const fee = feeOf(props.fee);
  const setLine = (index: number, change: Partial<PaymentLine>) =>
    onChange({
      ...payment,
      lines: payment.lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    });
  const take = (faces: number[]) => {
    const total = faces.reduce((sum, die) => sum + die, 0);
    onChange({ ...payment, roll: total, gold: String(feeGold(fee, total)) });
  };
  const pick = async (index: number, line: PaymentLine, value: string) => {
    if (value === NONE) return setLine(index, { pick: "none" });
    if (value !== ADD) return setLine(index, { pick: Number(value) });
    const made = await props.onAddCounter(line.resource);
    if (made) setLine(index, { pick: made.id });
  };

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2.5")}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          {compact ? null : <span className={LABEL}>Gold</span>}
          <span className="flex items-center gap-1.5">
            <NumberInput
              compact
              id={`${idPrefix}-gold`}
              aria-label="Gold paid"
              inputSize="sm"
              className="w-20 font-mono"
              value={payment.gold}
              onChange={(event) => onChange({ ...payment, gold: event.target.value })}
            />
            <span className="text-[13px] text-text2">gc</span>
          </span>
        </label>
        {fee.kind === "gold" && fee.dice ? (
          <DiceEntry
            dice={`${fee.dice}D6`}
            size="sm"
            total={payment.roll}
            onFaces={take}
            button={(roll) => (
              <Button size="sm" variant="secondary" className="h-9" onClick={roll}>
                <Dices aria-hidden="true" />
                {payment.roll === null ? "Roll" : "Roll again"} {fee.dice}D6
                {fee.dice_multiplier ? `×${fee.dice_multiplier}` : ""}
              </Button>
            )}
          />
        ) : null}
        {payment.roll !== null ? (
          <span className="pb-2 font-mono text-xs text-muted-foreground">
            rolled {payment.roll}
          </span>
        ) : null}
      </div>
      {payment.lines.map((line, index) => {
        const counter = counterOf(line, counters);
        const warning = lineWarning(line, counters);
        const missing = !matchCounter(line, counters); // no counter of its name: offer to add one
        return (
          <div key={`${line.resource}-${index}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
              <NumberInput
                compact
                aria-label={`${line.resource} paid`}
                inputSize="sm"
                className="w-14 font-mono"
                value={line.amount}
                onChange={(event) => setLine(index, { amount: event.target.value })}
              />
              <span className="font-semibold">{line.resource}</span>
              <span className="text-text2">from</span>
              <select
                aria-label={`What pays ${line.resource}`}
                value={line.pick === "none" ? NONE : (counter?.id ?? "")}
                onChange={(event) => void pick(index, line, event.target.value)}
                className="h-8 border border-strong bg-page px-1.5 text-[13px] text-ink"
              >
                {counter ? null : <option value="">Pick a resource…</option>}
                {counters.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.amount})
                  </option>
                ))}
                {missing ? <option value={ADD}>Add {line.resource}</option> : null}
                <option value={NONE}>Don&apos;t pay this</option>
              </select>
            </div>
            {warning ? (
              <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-danger">
                {warning}
                {counter && counter.amount > 0 ? (
                  <button
                    type="button"
                    className="font-bold text-accent-text underline"
                    onClick={() => setLine(index, { amount: String(counter.amount) })}
                  >
                    Pay the {counter.amount} it holds
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        );
      })}
      {fee.note && fee.kind !== "special" ? (
        // a fee in his rules shows its words above, with his rules (HireTerms)
        <span className="text-xs text-muted-foreground">{fee.note}</span>
      ) : null}
    </div>
  );
}
