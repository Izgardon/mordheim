import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

import type { TemplateLine } from "../../types/hire-template-types";
import { lineLabel, overWarbandMax, pickKey, tallyTotal, type KitPick } from "./hire-draft";
import type { UpgradePick } from "./useUpgradePicks";

type PriceProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  each: boolean;
};

function Price({ label, value, onChange, each }: PriceProps) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <NumberInput
        compact
        inputSize="sm"
        min={0}
        aria-label={`Price for ${label}`}
        placeholder="gc"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-16 text-[13px]"
      />
      {each ? "gc each" : "gc"}
    </label>
  );
}

const ROW = "flex min-h-9 items-center gap-2.5 border-t border-line py-1 first:border-t-0";

/**
 * What the hire costs, as the store's basket tallies it: his cost (each member's, for a group),
 * each item picked at its price, each upgrade picked (a hero's) and the free dagger. Every price
 * can be changed; the total and the gold left follow, and the server writes what the tally says.
 */
export default function HireTally({
  name,
  members,
  cost,
  onCost,
  picks,
  lines,
  prices,
  onPrice,
  freeItem,
  gold,
  upgrades = [],
  onUpgradePrice,
}: {
  /** What he is recruited as ("Champion", "Warriors"). */
  name: string;
  /** A group's models; 1 for a hero. */
  members: number;
  cost: string;
  onCost: (value: string) => void;
  picks: KitPick[];
  lines: TemplateLine[];
  prices: Record<string, string>;
  onPrice: (key: string, value: string) => void;
  freeItem: { id: number; name: string } | null;
  gold: number;
  /** A hero's upgrades picked, each at its price (the second and later of a group at double). */
  upgrades?: UpgradePick[];
  onUpgradePrice?: (id: number, value: string) => void;
}) {
  const each = members > 1;
  const extra = upgrades.reduce(
    (sum, pick) => sum + Math.max(0, Math.trunc(Number(pick.price) || 0)),
    0
  );
  const total = tallyTotal(cost, members, picks, prices) + extra;
  const left = gold - total;
  return (
    <div className="flex flex-col border-t border-accent-line pt-2">
      <ul aria-label="Tally" className="m-0 flex list-none flex-col p-0">
        <li className={ROW}>
          <span className="flex-1 text-[13px] font-bold text-ink">
            {name}
            {each ? ` ×${members}` : ""}
          </span>
          <Price label={name} value={cost} onChange={onCost} each={each} />
        </li>
        {picks.map((pick) => {
          const line = lines.find((entry) => entry.id === pick.lineId);
          if (!line) return null;
          const label = pick.brace ? `${lineLabel(line)}, brace` : lineLabel(line);
          const warning = overWarbandMax(line, (pick.brace ? 2 : 1) * members);
          return (
            <li key={pickKey(pick)} className={cn(ROW, "flex-wrap")}>
              <span className="flex-1 text-[13px] text-ink">
                {label}
                {each ? ` ×${members}` : ""}
                {line.cost === null && line.cost_note ? (
                  <span className="text-muted-foreground"> · {line.cost_note}</span>
                ) : null}
              </span>
              <Price
                label={label}
                value={prices[pickKey(pick)] ?? ""}
                onChange={(value) => onPrice(pickKey(pick), value)}
                each={each}
              />
              {warning ? <span className="basis-full text-xs text-danger">{warning}</span> : null}
            </li>
          );
        })}
        {upgrades.map((pick) => (
          <li key={`upgrade-${pick.upgrade.id}`} className={cn(ROW, "flex-wrap")}>
            <span className="flex-1 text-[13px] text-ink">{pick.upgrade.name}</span>
            <Price
              label={pick.upgrade.name}
              value={pick.price}
              onChange={(value) => onUpgradePrice?.(pick.upgrade.id, value)}
              each={false}
            />
            {pick.warning ? (
              <span className="basis-full text-xs text-danger">{pick.warning}</span>
            ) : null}
          </li>
        ))}
        {freeItem ? (
          <li className={ROW}>
            <span className="flex-1 text-[13px] text-ink">
              {freeItem.name}
              {each ? ` ×${members}` : ""}
            </span>
            <span className="text-xs font-semibold text-good">free</span>
          </li>
        ) : null}
      </ul>
      <p className="m-0 flex flex-wrap items-baseline gap-x-3 border-t border-line pt-2 text-[13px] text-text2">
        <span>
          Total <span className="font-mono font-bold text-head">{total} gc</span>
        </span>
        <span className={left < 0 ? "text-danger" : undefined}>
          Gold {gold} → {left} gc
        </span>
      </p>
    </div>
  );
}
