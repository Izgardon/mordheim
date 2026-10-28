import type { ChangeEvent } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@components/button";
import { Tooltip } from "@components/tooltip";
import {
  Select,
  SelectContent,
  SelectItem as SelectOption,
  SelectTrigger,
  SelectValue,
} from "@components/select";

import basicBar from "@/assets/containers/basic_bar.webp";

import type { Item, ItemAvailability } from "../../types/item-types";

const BAR_BACKGROUND = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

/** The dialog's help, in the corner: what buying and giving do. */
export function AcquireHelpButton() {
  return (
    <div className="absolute left-1 top-1">
      <Tooltip
        trigger={
          <button
            type="button"
            tabIndex={-1}
            className="icon-button flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition hover:text-foreground"
            aria-label="Acquire item help"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        }
        content="Buying uses rarity and price checks. Turn it off to give the item directly without paying."
        className="inline-flex"
      />
    </div>
  );
}

/** Buy (rarity and price checks) or Give (neither). */
export function AcquireModeToggle({
  isBuying,
  onChange,
}: {
  isBuying: boolean;
  onChange: (isBuying: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="inline-flex items-center rounded-full border border-border/60 bg-background/40 p-1 shadow-[0_12px_26px_rgba(12,7,3,0.45)]"
        style={BAR_BACKGROUND}
      >
        <Button
          type="button"
          variant={isBuying ? "default" : "secondary"}
          size="sm"
          aria-pressed={isBuying}
          onClick={() => onChange(true)}
          className="min-w-[120px] rounded-full px-5"
        >
          Buy item
        </Button>
        <Button
          type="button"
          variant={!isBuying ? "default" : "secondary"}
          size="sm"
          aria-pressed={!isBuying}
          onClick={() => onChange(false)}
          className="min-w-[120px] rounded-full px-5"
        >
          Give item
        </Button>
      </div>
      <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
        {isBuying ? "Buying uses rarity and price checks" : "Giving skips price and rarity checks"}
      </p>
    </div>
  );
}

/** "Acquiring: <item>", with the item's details in a tooltip. */
export function AcquiringItemLabel({
  item,
  availability,
}: {
  item: Item;
  availability: ItemAvailability | null;
}) {
  return (
    <p className="text-center text-lg text-muted-foreground">
      Acquiring:{" "}
      <Tooltip
        trigger={
          <span className="cursor-help font-medium text-foreground underline decoration-dotted underline-offset-2">
            {item.name}
          </span>
        }
        content={
          <div className="space-y-2 not-italic">
            <p className="font-bold text-foreground">{item.name}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {item.type}
              {item.subtype ? ` - ${item.subtype}` : ""}
            </p>
            {item.description && <p className="text-sm">{item.description}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {availability && (
                <>
                  <span>Cost: {availability.cost} gc</span>
                  <span>Rarity: {availability.rarity === 2 ? "Common" : availability.rarity}</span>
                  {availability.variable_cost && (
                    <span>Variable: {availability.variable_cost}</span>
                  )}
                </>
              )}
              {item.strength && <span>Strength: {item.strength}</span>}
              {item.range && <span>Range: {item.range}</span>}
              {item.save && <span>Save: {item.save}</span>}
            </div>
          </div>
        }
        maxWidth={360}
      />
    </p>
  );
}

/** The item's availabilities (by restriction), when it has more than one. */
export function AvailabilitySelect({
  availabilities,
  selectedId,
  onChange,
}: {
  availabilities: ItemAvailability[];
  selectedId: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="space-y-2 px-1">
      <label className="block text-sm font-semibold text-muted-foreground">Availability:</label>
      <Select
        value={selectedId !== null ? String(selectedId) : String(availabilities[0]?.id ?? "")}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select availability" />
        </SelectTrigger>
        <SelectContent>
          {availabilities.map((avail) => (
            <SelectOption key={avail.id} value={String(avail.id)}>
              {avail.restrictions?.length
                ? avail.restrictions.map((r) => r.restriction.restriction).join(", ")
                : "General"}{" "}
              — {avail.cost} gc, {avail.rarity === 2 ? "Common" : `Rarity ${avail.rarity}`}
            </SelectOption>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A gift's optional reason (spaces don't toggle the dialog's buttons). */
export function GiveReasonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const keepSpace = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key === " " || event.key === "Spacebar") {
      event.stopPropagation();
    }
  };
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">Reason:</span>
      </div>
      <div className="space-y-2">
        <input
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          onKeyDown={keepSpace}
          onKeyUp={keepSpace}
          className="w-full rounded-[6px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
          placeholder="Optional reason"
          style={BAR_BACKGROUND}
        />
      </div>
    </div>
  );
}
