import { X } from "lucide-react";

import { Button } from "@components/button";
import { DiceInput } from "@components/dice-input";
import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { Label } from "@components/label";
import WhoCanField from "@/features/catalogue/components/WhoCanField";
import { listOf } from "@/features/catalogue/utils/who-can-draft";

import { priceLabel, rarityLabel, whoLine } from "../utils/item-prices";
import {
  blankPriceRow,
  priceRowsPayload,
  type PriceRowDraft,
  type PriceRowField,
} from "../utils/price-rows";

type PriceRowsFieldProps = {
  campaignId: number;
  rows: PriceRowDraft[];
  onChange: (rows: PriceRowDraft[]) => void;
  /** A refusal's message under one of a row's fields (`availabilities.0.cost`), or the list's. */
  errorOf: (path: string) => string | undefined;
  /** The server's path to the rows ("availabilities", "item.availabilities"). */
  path: string;
  idPrefix: string;
  label?: string;
};

const FIELD = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";
/** The note fills the row the label and cost note leave it. */
const NOTE_SPAN = ["sm:col-span-3", "sm:col-span-2", "sm:col-span-1"];
const SERVER_FIELD: Partial<Record<PriceRowField, string>> = {
  multiplier: "dice_multiplier",
  costNote: "cost_note",
};

/**
 * An item's price rows (the items rebuild): each one's cost, dice as one unit ("[2] D6", its
 * multiplier behind a ×), rarity (blank: Common), a note shown when buying ("Heroes only"), and
 * who may buy it. A row's label ("Brace") and cost note show only where it already holds one
 * (William: "leave current data as is"). The item form and a beast's shop prices share it.
 */
export default function PriceRowsField(props: PriceRowsFieldProps) {
  const { rows, onChange, path, idPrefix } = props;
  const update = (index: number, patch: Partial<PriceRowDraft>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const id = (field: PriceRowField, index: number) => `${idPrefix}-${field}-${index}`;
  const errorOf = (index: number, field: PriceRowField) =>
    props.errorOf(`${path}.${index}.${SERVER_FIELD[field] ?? field}`);
  const text = (index: number, field: PriceRowField, label: string, placeholder?: string) => {
    const error = errorOf(index, field);
    return (
      <label className={FIELD} htmlFor={id(field, index)}>
        {label}
        <Input
          id={id(field, index)}
          inputSize="sm"
          value={rows[index][field]}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          inputMode={["cost", "rarity"].includes(field) ? "numeric" : undefined}
          onChange={(event) => update(index, { [field]: event.target.value })}
        />
        <FieldError message={error} />
      </label>
    );
  };
  const dice = (index: number) => {
    const row = rows[index];
    const errors = [errorOf(index, "dice"), errorOf(index, "multiplier")];
    return (
      <div className={FIELD}>
        <label htmlFor={id("dice", index)}>+ Dice</label>
        <DiceInput
          id={id("dice", index)}
          label={`Dice for price ${index + 1}`}
          count={row.dice}
          multiplier={row.multiplier}
          invalid={errors.some(Boolean)}
          onCountChange={(count) => update(index, { dice: count })}
          onMultiplierChange={(multiplier) => update(index, { multiplier })}
        />
        <FieldError message={errors.find(Boolean)} />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{props.label ?? "Prices"}</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, blankPriceRow()])}
        >
          Add a price
        </Button>
      </div>
      <FieldError message={props.errorOf(path)} />
      {rows.map((row, index) => {
        const [preview] = priceRowsPayload([row]);
        return (
          <div key={row.key} className="space-y-3 border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text2">
                {priceLabel(preview)} · {rarityLabel(preview.rarity)} · {whoLine(listOf(row.who))}
              </span>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, at) => at !== index))}
                className="text-muted-foreground hover:text-head"
                aria-label={`Remove price ${index + 1}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
              {text(index, "cost", "Cost (gc)")}
              {dice(index)}
              {text(index, "rarity", "Rarity", "Common")}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {row.holds.label ? text(index, "label", "Label") : null}
              <div className={NOTE_SPAN[Number(row.holds.label) + Number(row.holds.costNote)]}>
                {text(index, "note", "Note when buying")}
              </div>
              {row.holds.costNote ? text(index, "costNote", "Cost note") : null}
            </div>
            <WhoCanField
              campaignId={props.campaignId}
              id={`${idPrefix}-who-${index}`}
              label="Who can buy"
              value={row.who}
              onChange={(who) => update(index, { who })}
            />
          </div>
        );
      })}
    </div>
  );
}
