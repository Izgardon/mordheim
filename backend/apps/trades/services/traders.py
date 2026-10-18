"""A trade's traders: the hero each side names in its offer. His trading action is spent only when the trade
completes (decision 9).

Offering and locking only check him: a dead or dismissed hero is refused (BUG-109), one who already used his
action this round is a warning. Completion spends each side's trader with one guarded UPDATE and records the hero
it spent (`from_trader_spent` / `to_trader_spent`). Nothing before completion spends anything, so unlocking, a new
offer, a failed completion, closing and expiry have nothing to give back.
"""

from typing import Any

from django.utils import timezone

from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, on_roster

from .errors import TradeError
from .offers import TradeWarning, offer_trader_id, trader_spent_warning

SIDES = ("from", "to")


def check_trader(trade: TradeRequest, side: str) -> list[TradeWarning]:
    """The warnings for the trader the side's offer names, if any; TradeError when he isn't on the roster."""
    trader_id = offer_trader_id(getattr(trade, f"{side}_offer"))
    if trader_id is None:
        return []
    heroes = on_roster(Hero.objects.filter(id=trader_id, warband_id=getattr(trade, f"{side}_warband_id")))
    hero = heroes.only("id", "name", "trading_action").first()
    if hero is None:
        raise TradeError("Trader not found.")
    return [] if hero.trading_action else [trader_spent_warning(hero)]


def spend_traders(trade: TradeRequest, offers: dict[str, dict[str, Any]]) -> None:
    """Spend each side's trader who still has his trading action and record him on the trade; one who already
    traded this round trades anyway and isn't recorded (the caller saves both fields)."""
    for side in SIDES:
        trader_id = offers[side]["trader_id"]
        spent = None
        if trader_id is not None:
            heroes = Hero.objects.filter(id=trader_id, warband_id=getattr(trade, f"{side}_warband_id"))
            if heroes.filter(trading_action=True).update(trading_action=False, updated_at=timezone.now()):
                spent = trader_id
        setattr(trade, f"{side}_trader_spent_id", spent)
