/**
 * The wyrdstone sell prices' lookup (William, 8 Nov 2026: the rulebook's table): the total for
 * selling a number of shards at once in a size band, 8 or more reading the 8+ row.
 */
import { describe, expect, it } from "vitest";

import { BOOK_WYRDSTONE_PRICES, SHARD_ROWS, SIZE_BANDS, wyrdstonePrice } from "./wyrdstone-prices";

const BOOK = BOOK_WYRDSTONE_PRICES.map((row) => [...row]);

describe("wyrdstonePrice", () => {
  it("reads every row of the book's table, its first and last band included", () => {
    const firstBand = SHARD_ROWS.map((_, row) => wyrdstonePrice(BOOK, row + 1, 0));
    const lastBand = SHARD_ROWS.map((_, row) => wyrdstonePrice(BOOK, row + 1, 5));

    expect(firstBand).toEqual([45, 60, 75, 90, 110, 120, 145, 155]);
    expect(lastBand).toEqual([25, 35, 50, 55, 65, 70, 90, 100]);
    expect(SIZE_BANDS.map((_, band) => wyrdstonePrice(BOOK, 3, band))).toEqual([
      75, 70, 65, 60, 55, 50,
    ]);
  });

  it("prices 7 shards on the 7 row and 8 or more on the 8+ row", () => {
    expect(wyrdstonePrice(BOOK, 7, 2)).toBe(120);
    expect([8, 9, 30].map((shards) => wyrdstonePrice(BOOK, shards, 2))).toEqual([130, 130, 130]);
  });

  it("reads the campaign's own table, and the book's when it has none", () => {
    const own = BOOK.map((row) => row.map((price) => price + 1));

    expect(wyrdstonePrice(own, 3, 2)).toBe(66);
    expect(wyrdstonePrice(undefined, 3, 2)).toBe(65);
    expect(wyrdstonePrice([], 9, 0)).toBe(155);
  });

  it("has no price for no shards or a band the table lacks", () => {
    expect(wyrdstonePrice(BOOK, 0, 0)).toBeNull();
    expect(wyrdstonePrice(BOOK, 1.5, 0)).toBeNull();
    expect(wyrdstonePrice(BOOK, 2, 6)).toBeNull();
  });
});
