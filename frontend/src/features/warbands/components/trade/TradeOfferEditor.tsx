import { NumberInput } from "@components/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";
import { cn } from "@/lib/utils";

import type { WarbandHero } from "@/features/warbands/types/warband-types";
import type { DraftOffer, OfferableStashItem } from "@/features/warbands/utils/trade-offer";

type TradeOfferEditorProps = {
  draft: DraftOffer;
  heroes: WarbandHero[];
  maxGold: number;
  /** You have accepted: nothing can change until you unaccept. */
  locked: boolean;
  warchest: OfferableStashItem[];
  isWarchestLoading: boolean;
  warchestError: string;
  onTraderChange: (value: string) => void;
  onGoldChange: (typed: string) => void;
  onAddItem: (item: OfferableStashItem) => void;
};

/**
 * What you put into a trade: the trader (heroes who spent their trading action are offered but
 * disabled; ECON-TWEAK-01 greys them instead in PR C), your gold and your stash's items.
 */
export default function TradeOfferEditor({
  draft,
  heroes,
  maxGold,
  locked,
  warchest,
  isWarchestLoading,
  warchestError,
  onTraderChange,
  onGoldChange,
  onAddItem,
}: TradeOfferEditorProps) {
  return (
    <>
      <div className="grid gap-4 min-[960px]:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Trader
          </p>
          <Select
            value={draft.trader_id ? String(draft.trader_id) : "none"}
            onValueChange={onTraderChange}
            disabled={locked}
          >
            <SelectTrigger className="bg-background/70">
              <SelectValue placeholder="Select (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {heroes.map((hero) => (
                <SelectItem
                  key={hero.id}
                  value={String(hero.id)}
                  disabled={hero.trading_action === false}
                >
                  {hero.name || `Hero ${hero.id}`}
                  {hero.trading_action === false ? " (spent)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Add gold
            </p>
            <span className="text-xs text-muted-foreground">Available: {maxGold} gc</span>
          </div>
          <NumberInput
            min={0}
            max={maxGold}
            step={1}
            value={draft.gold ?? 0}
            onChange={(event) => onGoldChange(event.target.value)}
            disabled={locked}
            allowEmpty
            className="bg-background/70 border-border/60 text-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Warchest
          </p>
          {isWarchestLoading ? (
            <span className="text-xs text-muted-foreground">Loading...</span>
          ) : null}
        </div>
        {warchestError ? (
          <p className="text-xs text-red-400">{warchestError}</p>
        ) : (
          <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto pr-1 min-[960px]:grid-cols-4">
            {warchest.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAddItem(item)}
                disabled={locked || item.available <= 0}
                className={cn(
                  "rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left text-xs transition-colors",
                  item.available <= 0 || locked ? "opacity-50" : "hover:border-white/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{item.name}</span>
                  <span className="text-[0.55rem] text-muted-foreground">
                    {item.available}/{item.total}
                  </span>
                </div>
              </button>
            ))}
            {warchest.length === 0 && !isWarchestLoading ? (
              <div className="text-xs text-muted-foreground">No items in warchest.</div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
