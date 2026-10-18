"""A trade's traders: the hero a side names spends his trading action when that side locks.

The spend is one guarded UPDATE recorded on the request (`from_trader_spent` / `to_trader_spent`), so unlocking,
a new offer, a failed completion, closing and expiry give back exactly the heroes this trade spent (BUG-08). A
hero who had already used his action this round still trades, with a warning (decision 9): this trade spent
nothing, so it records and gives back nothing.
"""

from collections.abc import Iterable

from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, on_roster

from .errors import TradeError
from .offers import TradeWarning, offer_trader_id, trader_spent_warning

SIDES = ("from", "to")
SPENT_FIELDS = ["from_trader_spent", "to_trader_spent"]


def spend_trader(trade: TradeRequest, side: str) -> list[TradeWarning]:
    """Spend the trader the side's offer names, if any, and record it. One who already traded this round is a
    warning: he stays spent and nothing is recorded. TradeError when he isn't on the roster: a dead or dismissed
    hero can't trade (BUG-109)."""
    trader_id = offer_trader_id(getattr(trade, f"{side}_offer"))
    if trader_id is None:
        return []
    heroes = on_roster(Hero.objects.filter(id=trader_id, warband_id=getattr(trade, f"{side}_warband_id")))
    if heroes.filter(trading_action=True).update(trading_action=False):
        setattr(trade, f"{side}_trader_spent_id", trader_id)
        return []
    spent = heroes.only("id", "name").first()
    if spent is None:
        raise TradeError("Trader not found.")
    return [trader_spent_warning(spent)]


def restore_spent_traders(trade: TradeRequest, sides: Iterable[str] = SIDES) -> None:
    """Give back the trading actions this trade spent on `sides` (the caller saves the request)."""
    sides = tuple(sides)
    spent = [getattr(trade, f"{side}_trader_spent_id") for side in sides]
    hero_ids = [hero_id for hero_id in spent if hero_id is not None]
    if hero_ids:
        Hero.objects.filter(id__in=hero_ids).update(trading_action=True)
    for side in sides:
        setattr(trade, f"{side}_trader_spent_id", None)
