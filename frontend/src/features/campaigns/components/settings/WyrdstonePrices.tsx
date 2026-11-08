import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOOK_WYRDSTONE_PRICES,
  SHARD_ROWS,
  SIZE_BANDS,
} from "@/features/warbands/utils/wyrdstone-prices";

import type { CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import { SettingRow } from "./settings-ui";

type Draft = string[][];

const draftOf = (table: readonly (readonly number[])[]): Draft =>
  table.map((row) => row.map(String));

const sameTable = (draft: Draft, table: readonly (readonly number[])[]) =>
  draft.every((row, shards) => row.every((cell, band) => cell === String(table[shards]?.[band])));

const CELL = "h-8 w-full min-w-0 px-1.5 text-center font-mono md:h-9";

/**
 * The wyrdstone sell prices (`edit_settings`; William, 8 Nov 2026: the rulebook's table): the gold
 * for selling 1 to 8+ shards of the default resource at once, by warband size. Each cell is
 * edited, Reset puts the book's back in the boxes, and Save sends the whole table.
 */
export default function WyrdstonePrices({ campaign }: { campaign: CampaignSummary }) {
  const current = campaign.wyrdstone_prices?.length
    ? campaign.wyrdstone_prices
    : BOOK_WYRDSTONE_PRICES;
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const { saving, error, setError, save } = useCampaignSave(
    campaign.id,
    "Couldn't save the prices."
  );
  useEffect(() => setDraft(draftOf(current)), [current]);
  const resource = campaign.default_resource_name ?? "Wyrdstone";

  const setCell = (shards: number, band: number, text: string) =>
    setDraft((rows) =>
      rows.map((row, at) =>
        at === shards ? row.map((cell, column) => (column === band ? text : cell)) : row
      )
    );
  const submit = () => {
    if (draft.some((row) => row.some((cell) => cell.trim() === ""))) {
      setError("Give every cell a price in whole crowns.");
      return;
    }
    void save({ wyrdstone_prices: draft.map((row) => row.map(Number)) });
  };

  return (
    <SettingRow
      label={`${resource} sell prices`}
      error={error}
      below={
        <div className="flex flex-col gap-2.5">
          <table className="w-full max-w-[560px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                <th scope="col" className="w-14 pb-1 text-left font-bold">
                  Shards
                </th>
                <th scope="colgroup" colSpan={SIZE_BANDS.length} className="pb-1 font-bold">
                  Warriors
                </th>
              </tr>
              <tr className="font-mono text-xs text-text2">
                <td />
                {SIZE_BANDS.map((band) => (
                  <th key={band} scope="col" className="pb-1 font-semibold">
                    {band}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHARD_ROWS.map((shards, row) => (
                <tr key={shards}>
                  <th scope="row" className="text-left font-mono text-xs font-semibold text-text2">
                    {shards}
                  </th>
                  {SIZE_BANDS.map((band, column) => (
                    <td key={band} className="p-0.5">
                      <Input
                        inputMode="numeric"
                        inputSize="sm"
                        aria-label={`${shards} shards, ${band} warriors`}
                        value={draft[row]?.[column] ?? ""}
                        onChange={(event) =>
                          setCell(row, column, event.target.value.replace(/\D/g, ""))
                        }
                        className={CELL}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(draftOf(BOOK_WYRDSTONE_PRICES))}>
              Reset
            </Button>
            <Button
              variant="secondary"
              disabled={saving || sameTable(draft, current)}
              onClick={submit}
            >
              {saving ? "Saving…" : "Save prices"}
            </Button>
          </div>
        </div>
      }
    />
  );
}
