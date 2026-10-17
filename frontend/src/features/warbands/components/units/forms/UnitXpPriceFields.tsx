import { useId } from "react";

import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";

import type { UnitFormBase } from "./form-types";

type XpPriceForm = UnitFormBase & {
  no_level_ups?: boolean;
  rating?: string;
  upkeep_price?: string;
};

type UnitXpPriceFieldsProps<T extends XpPriceForm> = {
  /** hero: XP | price; hired: XP | rating, then price | upkeep; henchmen: XP | base cost. */
  variant: "hero" | "hired_sword" | "henchmen";
  form: T;
  index: number;
  inputClassName: string;
  onUpdate: (index: number, updater: (form: T) => T) => void;
  priceLabel: string;
};

const labelClassName = "text-sm font-semibold text-foreground";
const labelRowClassName = "flex min-h-[28px] flex-wrap items-center gap-2";

/** Experience (with half rate, hidden for "no level ups") and the kind's cost fields. */
export default function UnitXpPriceFields<T extends XpPriceForm>({
  variant,
  form,
  index,
  inputClassName,
  onUpdate,
  priceLabel,
}: UnitXpPriceFieldsProps<T>) {
  const levelUpId = useId();
  const set = (field: "xp" | "level_up" | "price" | "rating" | "upkeep_price", value: string) =>
    onUpdate(index, (current) => ({ ...current, [field]: value }));
  const numberInput = (field: "price" | "rating" | "upkeep_price", value: string) => (
    <NumberInput
      min={0}
      value={value}
      onChange={(event) => set(field, event.target.value)}
      placeholder="0"
      className={inputClassName}
    />
  );
  const numberField = (
    wrapperClassName: string,
    label: string,
    field: "price" | "rating" | "upkeep_price",
    value: string
  ) => (
    <div className={wrapperClassName}>
      <div className={labelRowClassName}>
        <Label className={labelClassName}>{label}</Label>
      </div>
      {numberInput(field, value)}
    </div>
  );

  const experience = form.no_level_ups ? null : (
    <div className="space-y-2">
      <div className={labelRowClassName}>
        <Label className={labelClassName}>Experience</Label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <Checkbox
            checked={form.half_rate}
            onChange={(event) =>
              onUpdate(index, (current) => ({ ...current, half_rate: event.target.checked }))
            }
          />
          <span>(Half rate experience)</span>
        </label>
      </div>
      <NumberInput
        min={0}
        step={form.half_rate ? 0.5 : 1}
        value={form.xp}
        onChange={(event) => set("xp", event.target.value)}
        placeholder="0"
        className={inputClassName}
      />
    </div>
  );
  // Decision 5: a saved unit's count is the player's to correct; Save sends it as typed.
  const levelUps =
    form.no_level_ups || !form.id ? null : (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={levelUpId} className={labelClassName}>
            Pending level-ups
          </Label>
          <NumberInput
            id={levelUpId}
            min={0}
            compact
            inputSize="sm"
            value={form.level_up ?? "0"}
            onChange={(event) => set("level_up", event.target.value)}
            className={inputClassName}
          />
        </div>
        <p className="text-xs text-muted-foreground">Lowering XP keeps level-ups already earned.</p>
      </div>
    );
  const xpRowClassName = `grid gap-3 ${form.no_level_ups ? "grid-cols-1 md:grid-cols-1" : "grid-cols-2 md:grid-cols-2"}`;

  if (variant === "henchmen") {
    return (
      <>
        <div className={xpRowClassName}>
          {experience}
          <div className="flex min-h-[92px] flex-col justify-between gap-2 md:min-h-0">
            <div className="flex min-h-[28px] flex-wrap items-end gap-2">
              <Label className={labelClassName}>{priceLabel}</Label>
            </div>
            {numberInput("price", form.price)}
          </div>
        </div>
        {levelUps}
      </>
    );
  }

  if (variant === "hired_sword") {
    return (
      <>
        <div className={xpRowClassName}>
          {experience}
          {numberField(
            "flex h-full flex-col justify-between gap-2",
            "Rating",
            "rating",
            form.rating ?? "0"
          )}
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-2">
          {numberField("space-y-2", priceLabel, "price", form.price)}
          {numberField("space-y-2", "Upkeep price", "upkeep_price", form.upkeep_price ?? "0")}
        </div>
        {levelUps}
      </>
    );
  }

  return (
    <>
      <div className={xpRowClassName}>
        {experience}
        {numberField("flex h-full flex-col justify-between gap-2", priceLabel, "price", form.price)}
      </div>
      {levelUps}
    </>
  );
}
