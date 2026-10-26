"""Other members follow a warband's beasts live (the bestiary rewrite's browser check, item 24).

A companion switched on or off, creatures recruited into henchmen (from the stash or a unit, or straight from a
purchase; into a new group or joining one) and members sent back to their creature's item each send
`warband.changed` {warband_id} on `private-campaign-{id}-events` after their commit, skipping the writer's socket:
another member with the warband's page open reads its sheet again. A refused write sends nothing. Pusher is replaced
by a mock that records triggers.
"""

from typing import Any
from unittest import mock

from django.test import override_settings

from apps.warbands.models import HeroItem, LedgerAction, WarbandItem
from apps.warbands.services import ledger

from .beast_support import beast, wardogs, warhorse
from .roster_support import HENCHMEN, HERO, RosterTestCase, make_unit, unit_url

SOCKET = "123.456"


@override_settings(EXTERNAL_DISPATCH_SYNC=True)
class WarbandChangedEventTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pusher = mock.Mock()
        patcher = mock.patch("apps.realtime.services.get_pusher_client", return_value=self.pusher)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.horse, self.dogs = warhorse(), wardogs()
        self.hero = make_unit(HERO, self.warband, name="Aldric")
        ledger.record(self.warband, LedgerAction.REWARD, 500, "Purse")

    def post(self, url: str, body: dict[str, Any]) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(url, body, format="json", HTTP_X_PUSHER_SOCKET_ID=SOCKET)

    def changed(self) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
        """(channel, payload, keyword arguments) of each `warband.changed` sent, in order; then forgotten."""
        sent = [
            (call.args[0], call.args[2], call.kwargs)
            for call in self.pusher.trigger.call_args_list
            if call.args[1] == "warband.changed"
        ]
        self.pusher.reset_mock()
        return sent

    def one_event(self) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
        channel = f"private-campaign-{self.campaign.id}-events"
        return [(channel, {"warband_id": self.warband.id}, {"socket_id": SOCKET})]

    def recruit_url(self) -> str:
        return f"/api/warbands/{self.warband.id}/beasts/recruit/"

    def test_a_companion_switched_on_or_off_tells_the_other_members(self):
        row = HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80)
        url = unit_url(HERO, self.warband.id, self.hero.id, f"items/{row.id}/companion/")

        switched_on = self.post(url, {"on": True})
        on = self.changed()
        switched_off = self.post(url, {"on": False})

        self.assertEqual((switched_on.status_code, switched_off.status_code), (200, 200))
        self.assertEqual((on, self.changed()), (self.one_event(), self.one_event()))

    def test_creatures_recruited_into_a_new_group_or_joining_one_tell_them(self):
        WarbandItem.objects.create(warband=self.warband, item=self.dogs, quantity=2, cost=25)
        source = {"type": "stash", "item_id": self.dogs.id}

        formed = self.post(self.recruit_url(), {"source": source, "target": {"new": {"name": "Kennel"}}})
        new = self.changed()
        joined = self.post(self.recruit_url(), {"source": source, "target": {"group_id": formed.data["group"]["id"]}})

        self.assertEqual((formed.status_code, joined.status_code), (201, 201))
        self.assertEqual((new, self.changed()), (self.one_event(), self.one_event()))

    def test_a_purchase_that_recruits_tells_them(self):
        body = {"item_id": self.dogs.id, "quantity": 2, "target_type": "stash", "recruit": {"new": {"name": "Kennel"}}}

        response = self.post(f"/api/warbands/{self.warband.id}/purchases/", body)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.changed(), self.one_event())

    def test_members_sent_back_to_their_item_tell_them(self):
        group = make_unit(HENCHMEN, self.warband, name="Kennel", members=("A", "B"), price=25, source_beast=beast(self.dogs))  # fmt: skip

        response = self.post(unit_url(HENCHMEN, self.warband.id, group.id, "back-to-item/"), {"count": 1})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.changed(), self.one_event())

    def test_a_refused_write_tells_nobody(self):
        sword = HeroItem.objects.create(hero=self.hero, item=self.sword, cost=10)
        horse = HeroItem.objects.create(hero=self.hero, item=self.horse, cost=80)
        too_many = {"source": {"type": "stash", "item_id": self.dogs.id}, "quantity": 3, "target": {"new": {}}}

        statuses = [
            self.post(unit_url(HERO, self.warband.id, self.hero.id, f"items/{sword.id}/companion/"), {"on": True}),
            self.post(self.recruit_url(), too_many),
        ]
        self.client.force_authenticate(user=self.viewer)  # may read the warband, not change it
        statuses.append(self.post(unit_url(HERO, self.warband.id, self.hero.id, f"items/{horse.id}/companion/"), {"on": True}))  # fmt: skip

        self.assertEqual([response.status_code for response in statuses], [400, 400, 403])
        self.assertEqual(self.changed(), [])
