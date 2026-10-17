"""Shared fixtures for the trade characterisation tests (pass 2).

The `test_trade_characterisation_*` modules lock in how the player-to-player trade endpoints behave
today, before PR A fixes them and PR B splits `trades/views.py`. Known bugs are pinned with their
BUGS.md ID and the comment "Characterises current behaviour (BUG-NN, pinned; flips in PR A)".
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.test import override_settings
from django.utils import timezone

from apps.items.models import Item
from apps.notifications.models import Notification
from apps.realtime import services as realtime
from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, Warband, WarbandItem, WarbandTrade
from apps.warbands.tests.roster_support import RosterTestCase
from apps.warbands.utils.trades import TradeHelper

# The keys of every trade payload (responses, realtime events and notifications), in order.
PAYLOAD_KEYS = [
    "id",
    "campaign_id",
    "status",
    "created_at",
    "responded_at",
    "expires_at",
    "from_offer",
    "to_offer",
    "from_accepted",
    "to_accepted",
    "offer_version",
    "from_user",
    "to_user",
    "from_warband",
    "to_warband",
    "channel",
]


@override_settings(RATE_LIMIT_ENABLED=False)  # trade writes are throttled per user and per IP (20 and 60 a minute)
class TradeTestCase(RosterTestCase):
    """RosterTestCase's campaign, seen as a trade: `player` (warband "Monks") trades with `viewer` (warband
    "Rats"). `campaign_owner`, `admin` and `manager` are members without a warband and `outsider` isn't a
    member. Labels are first names: "playe" and "viewe".

    The test runner forces Pusher off, so the realtime helpers the views call are wrapped (still run) and
    their calls recorded in `user_events` and `trade_events`.
    """

    user_events: mock.MagicMock
    trade_events: mock.MagicMock

    def setUp(self) -> None:
        super().setUp()
        self.user_events = self._record("send_user_notification")
        self.trade_events = self._record("send_trade_event")

    def _record(self, name: str) -> mock.MagicMock:
        patcher = mock.patch(f"apps.trades.views.{name}", wraps=getattr(realtime, name))
        recorded = patcher.start()
        self.addCleanup(patcher.stop)
        return recorded

    # URLs and requests

    def trades_url(self, campaign_id: int | None = None) -> str:
        return f"/api/campaigns/{campaign_id or self.campaign.id}/trade-requests/"

    def trade_url(self, trade: TradeRequest, action: str = "", campaign_id: int | None = None) -> str:
        return f"{self.trades_url(campaign_id)}{trade.id}/" + (f"{action}/" if action else "")

    def post_as(self, user: Any, url: str, body: dict[str, Any] | None = None) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.post(url, body or {}, format="json")

    def get_as(self, user: Any, url: str) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.get(url)

    def request_trade(self, from_user: Any = None, to_user: Any = None) -> TradeRequest:
        """POST a trade request (player to viewer by default) and return it from the database."""
        to_user = to_user or self.viewer
        response = self.post_as(from_user or self.player, self.trades_url(), {"target_user_id": to_user.id})
        self.assertEqual(response.status_code, 201, response.data)
        return TradeRequest.objects.get(id=response.json()["id"])

    def make_trade(self, status: str = "pending", from_user: Any = None, to_user: Any = None) -> TradeRequest:
        """A trade row written directly, without a notification: for tests that need several between the same two
        players at once, which the API refuses (BUG-114)."""
        from_user, to_user = from_user or self.player, to_user or self.viewer
        warbands = {self.player.id: self.warband, self.viewer.id: self.rival}
        return TradeRequest.objects.create(
            campaign=self.campaign,
            from_user=from_user,
            to_user=to_user,
            from_warband=warbands[from_user.id],
            to_warband=warbands[to_user.id],
            status=status,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

    def open_trade(self) -> TradeRequest:
        """A request from player to viewer that viewer has accepted: both sides can now make offers."""
        trade = self.request_trade()
        response = self.post_as(self.viewer, self.trade_url(trade, "accept"))
        self.assertEqual(response.status_code, 200, response.data)
        trade.refresh_from_db()
        return trade

    def offer(self, user: Any, trade: TradeRequest, **body: Any) -> Any:
        return self.post_as(user, self.trade_url(trade, "offer"), body)

    def lock(self, user: Any, trade: TradeRequest) -> Any:
        return self.post_as(user, self.trade_url(trade, "lock"))

    def unlock(self, user: Any, trade: TradeRequest) -> Any:
        return self.post_as(user, self.trade_url(trade, "unlock"))

    # Data

    def give_gold(self, warband: Warband, amount: int) -> None:
        TradeHelper.create_trade(warband=warband, action="Reward", description="Purse", price=amount)

    def stash(self, warband: Warband, item: Item, quantity: int, cost: int | None = None) -> WarbandItem:
        return WarbandItem.objects.create(warband=warband, item=item, quantity=quantity, cost=cost)

    def stash_rows(self, warband: Warband) -> list[tuple[str, int, int | None]]:
        """(item name, quantity, cost) for each stash row, by item name."""
        rows = WarbandItem.objects.filter(warband=warband).order_by("item__name", "item_id")
        return [(row.item.name, row.quantity, row.cost) for row in rows.select_related("item")]

    def ledger(self, warband: Warband) -> list[tuple[str, str, int]]:
        """(action, description, price) for each ledger row, oldest first."""
        return list(
            WarbandTrade.objects.filter(warband=warband).order_by("id").values_list("action", "description", "price")
        )

    def trader(self, warband: Warband, name: str = "Haggler", **fields: Any) -> Hero:
        return Hero.objects.create(warband=warband, name=name, unit_type="Champion", **fields)

    def trading_action(self, hero: Hero) -> bool:
        hero.refresh_from_db()
        return hero.trading_action

    def expire(self, trade: TradeRequest) -> None:
        TradeRequest.objects.filter(id=trade.id).update(expires_at=timezone.now() - timedelta(minutes=1))

    def notification(self, user: Any, trade: TradeRequest) -> Notification:
        return Notification.objects.get(
            user=user, notification_type=Notification.TYPE_TRADE_REQUEST, reference_id=str(trade.id)
        )

    def state(self, trade: TradeRequest) -> tuple[str, bool, bool]:
        """(status, from_accepted, to_accepted) as stored."""
        trade.refresh_from_db()
        return trade.status, trade.from_accepted, trade.to_accepted

    def event_names(self) -> list[str]:
        """The trade-channel events sent so far, in order."""
        return [call.args[1] for call in self.trade_events.call_args_list]
