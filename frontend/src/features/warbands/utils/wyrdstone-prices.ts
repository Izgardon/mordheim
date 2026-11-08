/**
 * The wyrdstone sell prices (William, 8 Nov 2026: the rulebook's table): the gold a warband gets in
 * all for selling a number of shards at once, by its size band. The campaign keeps its own copy
 * (`wyrdstone_prices`) and the server says which band a warband is in (its summary's `size_band`);
 * the book's table here is what Settings' Reset puts back.
 */

/** The table's columns: how many warriors the warband has. */
export const SIZE_BANDS = ["1-3", "4-6", "7-9", "10-12", "13-15", "16+"] as const;

/** The table's rows: how many shards are sold at once. */
export const SHARD_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8+"] as const;

export const BOOK_WYRDSTONE_PRICES: readonly (readonly number[])[] = [
  [45, 40, 35, 30, 30, 25],
  [60, 55, 50, 45, 40, 35],
  [75, 70, 65, 60, 55, 50],
  [90, 80, 70, 65, 60, 55],
  [110, 100, 90, 80, 70, 65],
  [120, 110, 100, 90, 80, 70],
  [145, 130, 120, 110, 100, 90],
  [155, 140, 130, 120, 110, 100],
];

/**
 * The table's total for selling `shards` at once in `band`: 8 or more read the 8+ row. Null for
 * no shards or a cell the table lacks.
 */
export function wyrdstonePrice(
  table: readonly (readonly number[])[] | undefined,
  shards: number,
  band: number
): number | null {
  const rows = table?.length ? table : BOOK_WYRDSTONE_PRICES;
  if (!Number.isInteger(shards) || shards < 1) return null;
  const price = rows[Math.min(shards, rows.length) - 1]?.[band];
  return typeof price === "number" ? price : null;
}
