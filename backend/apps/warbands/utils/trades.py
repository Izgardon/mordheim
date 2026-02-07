from __future__ import annotations

from apps.warbands.models import Warband, WarbandTrade


class TradeHelper:
    NEGATIVE_TRADE_ACTIONS = {"Purchase", "Upkeep", "Buy", "Hire"}

    @staticmethod
    def normalize_price(action: str, price: int | float | None) -> int:
        raw = int(price or 0)
        if raw < 0:
            raw = abs(raw)
        if action in TradeHelper.NEGATIVE_TRADE_ACTIONS:
            return -raw
        return raw

    @staticmethod
    def create_trade(
        *,
        warband: Warband,
        action: str,
        description: str,
        price: int | float | None,
        notes: str | None = "",
    ) -> WarbandTrade:
        normalized_price = TradeHelper.normalize_price(action, price)
        return WarbandTrade.objects.create(
            warband=warband,
            action=action,
            description=description,
            price=normalized_price,
            notes=notes or "",
        )

    @staticmethod
    def upsert_starting_gold_trade(warband: Warband, starting_gold: int) -> None:
        trade = WarbandTrade.objects.filter(warband=warband).order_by("created_at").first()
        if trade:
            trade.action = "Starting Gold"
            trade.description = "Starting Gold"
            trade.price = TradeHelper.normalize_price(trade.action, starting_gold)
            trade.notes = trade.notes or ""
            trade.save(update_fields=["action", "description", "price", "notes", "updated_at"])
            return

        TradeHelper.create_trade(
            warband=warband,
            action="Starting Gold",
            description="Starting Gold",
            price=starting_gold,
            notes="",
        )
