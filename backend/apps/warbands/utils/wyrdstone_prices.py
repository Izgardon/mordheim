"""Wyrdstone sell prices (William, 8 Nov 2026: the rulebook's table): the gold a warband gets in total for selling a
number of shards at once, by how many warriors it has.

A campaign keeps its own copy (`CampaignSettings.wyrdstone_prices`, the book's until Settings changes it): eight rows,
1 to 7 shards and then 8 or more, each with a price for each of the six size bands. The sell form reads the cell for
the shards sold and the warband's band (`size_band`, from the warband size that the "of 15" figure counts), and the
player may pick another band (the Halflings' Master Chef and the like) or change the total.
"""

# the book's table, a row for 1, 2, ... 7 shards and the last for 8 or more; a column for each band in SIZE_BANDS
BOOK_WYRDSTONE_PRICES = (
    (45, 40, 35, 30, 30, 25),
    (60, 55, 50, 45, 40, 35),
    (75, 70, 65, 60, 55, 50),
    (90, 80, 70, 65, 60, 55),
    (110, 100, 90, 80, 70, 65),
    (120, 110, 100, 90, 80, 70),
    (145, 130, 120, 110, 100, 90),
    (155, 140, 130, 120, 110, 100),
)
# each band's fewest warriors: 1-3, 4-6, 7-9, 10-12, 13-15, 16+
SIZE_BANDS = (1, 4, 7, 10, 13, 16)
SHARD_ROWS = len(BOOK_WYRDSTONE_PRICES)


def get_default_wyrdstone_prices() -> list[list[int]]:
    return [list(row) for row in BOOK_WYRDSTONE_PRICES]


def size_band(warriors: int) -> int:
    """The table's column for a warband of `warriors` (0 for 1-3, a warband with none counting as the smallest; 5 for
    16 or more)."""
    return max(0, sum(1 for fewest in SIZE_BANDS if warriors >= fewest) - 1)
