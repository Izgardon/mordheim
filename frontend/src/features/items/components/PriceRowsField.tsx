import { X } from "lucide-react";

import { Button } from "@components/button";
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

/**
 * An item's price rows (the items rebuild): each one's cost, dice ("25 + 2D6", "200 + D6×25"),
 * rarity (blank: Common), a label naming a variant row ("Brace"), a note shown when buying
 * ("Heroes only"), a cost note, and who may buy it. The item form and a beast's shop prices share it.
 */
export default function PriceRowsField(props: PriceRowsFieldProps) {
  const { rows, onChange, path, idPrefix } = props;
  const update = (index: number, patch: Partial<PriceRowDraft>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const text = (index: number, field: PriceRowField, label: string, placeholder?: string) => {
    const id = `${idPrefix}-${field}-${index}`;
    const serverField =
      field === "multiplier" ? "dice_multiplier" : field === "costNote" ? "cost_note" : field;
    const error = props.errorOf(`${path}.${index}.${serverField}`);
    return (
      <label className={FIELD} htmlFor={id}>
        {label}
        <Input
          id={id}
          inputSize="sm"
          value={rows[index][field]}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          inputMode={
            ["cost", "dice", "multiplier", "rarity"].includes(field) ? "numeric" : undefined
          }
          onChange={(event) => update(index, { [field]: event.target.value })}
        />
        <FieldError message={error} />
      </label>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {text(index, "cost", "Cost (gc)")}
              {text(index, "dice", "+ D6s")}
              {text(index, "multiplier", "× each pip", "1")}
              {text(index, "rarity", "Rarity", "Common")}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {text(index, "label", "Label")}
              {text(index, "note", "Note when buying")}
              {text(index, "costNote", "Cost note")}
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
