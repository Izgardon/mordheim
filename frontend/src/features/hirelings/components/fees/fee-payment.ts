import { feeGold, feeOf, matchCounter, type Fee } from "../../fees";

/** A counter of the warband's (its resources): what pays a fee's resource line. */
export type Counter = { id: number; name: string; amount: number; is_default?: boolean };

/**
 * What a fee's resource line is paid from: a counter's id, "none" (Don't pay this), or undefined
 * for the counter of its name, the default resource for Wyrdstone (the server's default too).
 */
export type LinePick = number | "none" | undefined;

export type PaymentLine = {
  resource: string;
  amount: string;
  names?: string[];
  default_resource?: boolean;
  pick: LinePick;
};

/** What the player pays, every part prefilled from the fee and editable (the fees step). */
export type Payment = { gold: string; roll: number | null; lines: PaymentLine[] };

/** A fee's payment as it starts: its gold (no roll yet) and its resource lines. */
export function paymentOf(raw: Fee | null | undefined): Payment {
  const fee = feeOf(raw);
  return {
    gold: String(feeGold(fee)),
    roll: null,
    lines: fee.resources.map((line) => ({
      resource: line.resource,
      amount: String(line.amount),
      names: line.names,
      default_resource: line.default_resource,
      pick: undefined,
    })),
  };
}

const whole = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

/** The counter that pays a line as it stands: the one picked, else the one of its name. */
export function counterOf(line: PaymentLine, counters: Counter[]) {
  if (line.pick === "none") return null;
  if (typeof line.pick === "number") return counters.find((c) => c.id === line.pick) ?? null;
  return matchCounter(line, counters);
}

/** What a line warns about: no counter pays it, or its counter holds too few. */
export function lineWarning(line: PaymentLine, counters: Counter[]) {
  if (line.pick === "none") return "";
  const counter = counterOf(line, counters);
  const amount = whole(line.amount);
  if (!counter) return amount ? `This warband has no ${line.resource}.` : "";
  return counter.amount < amount ? `${counter.name} holds ${counter.amount}.` : "";
}

/** The request's resource lines: each with the counter that pays it, or null (not paid). */
export const paymentLines = (payment: Payment, counters: Counter[]) =>
  payment.lines.map((line) => ({
    resource: line.resource,
    amount: whole(line.amount),
    resource_id: counterOf(line, counters)?.id ?? null,
  }));

/** The gold the payment charges. */
export const paymentGold = (payment: Payment) => whole(payment.gold);
