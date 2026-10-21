"""Catalogue changes reach the other members without waiting for the stale time (pass 5 PR C; BUG-80).

Every write that changes what a campaign's list shows sends `catalogue.changed` {kind} on
`private-campaign-{id}-events` after its commit, skipping the writer's socket: creates, edits (a book entry's
version included), reverts, deletes, archives, removals and restores, a house rule's clones, and an injury's new
special. A bestiary or hired-sword write names both lists. A refused write sends nothing; a seed (a book change)
sends nothing per campaign. Pusher is replaced by a mock that records triggers.
"""

from io import StringIO
from typing import Any
from unittest import mock

from django.core.management import call_command
from django.test import override_settings

from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, KINDS, SKILLS, CatalogueTestCase, make_entry

SOCKET = "123.456"


@override_settings(EXTERNAL_DISPATCH_SYNC=True)
class CatalogueEventTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pusher = mock.Mock()
        patcher = mock.patch("apps.realtime.services.get_pusher_client", return_value=self.pusher)
        patcher.start()
        self.addCleanup(patcher.stop)

    def send(self, method: str, url: str, body: dict[str, Any] | None = None, user: Any = None) -> Any:
        self.client.force_authenticate(user=user or self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            return getattr(self.client, method)(url, body or {}, format="json", HTTP_X_PUSHER_SOCKET_ID=SOCKET)

    def changed(self) -> list[tuple[str, str, dict[str, Any]]]:
        """(channel, kind, keyword arguments) of each `catalogue.changed` sent, in order; then forgotten."""
        sent = [
            (call.args[0], call.args[2]["kind"], call.kwargs)
            for call in self.pusher.trigger.call_args_list
            if call.args[1] == "catalogue.changed"
        ]
        self.pusher.reset_mock()
        return sent

    def channel(self) -> str:
        return f"private-campaign-{self.campaign.id}-events"

    def test_every_write_tells_the_other_members_which_list_changed(self):
        # BUG-80 (was pinned: nothing was sent, so members saw a change only after the 5-minute stale time; PR C)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                lists = {BESTIARY.key, HIRED_SWORDS.key} if kind in (BESTIARY, HIRED_SWORDS) else {kind.key}
                created = self.send("post", kind.list_url(), kind.body(f"Live {kind.key}", self.campaign))
                url = kind.detail_url(created.data["id"])
                statuses = [created.status_code, self.send("patch", url, {"name": "Changed"}).status_code]
                statuses.append(self.send("delete", url).status_code)

                self.assertEqual(statuses, [201, 200, 204])
                sent = self.changed()
                self.assertEqual({entry[1] for entry in sent}, lists)
                self.assertEqual(len(sent), 3 * len(lists))
                self.assertEqual({(channel, str(options)) for channel, _, options in sent}, {(self.channel(), str({"socket_id": SOCKET}))})  # fmt: skip

    def test_versions_reverts_archives_removals_and_restores_tell_them_too(self):
        version = self.send("patch", SKILLS.detail_url(self.infiltration[0].id), {"campaign_id": self.campaign.id, "description": "Hides."})  # fmt: skip
        self.send("post", f"{SKILLS.detail_url(version.data['id'])}revert/")
        self.send("delete", f"{SKILLS.detail_url(self.infiltration[1].id)}?campaign_id={self.campaign.id}")
        self.send("post", f"{SKILLS.detail_url(self.infiltration[1].id)}restore/", {"campaign_id": self.campaign.id})

        self.assertEqual([kind for _, kind, _ in self.changed()], ["skills"] * 4)

    def test_house_rules_and_new_injury_specials_tell_them_and_refusals_and_seeds_do_not(self):
        self.send("post", self.url("rules/"), {"title": "Half price", "effect_key": HALF_PRICE_ARMOUR_EFFECT_KEY})
        rule_kinds = [kind for _, kind, _ in self.changed()]
        refused = self.send("post", ITEMS.list_url(), ITEMS.body("Axe", self.campaign), user=self.player)  # taken
        denied = self.send("delete", ITEMS.detail_url(make_entry(ITEMS, "Club", campaign=self.campaign).id), user=self.player)  # fmt: skip
        with self.captureOnCommitCallbacks(execute=True):
            call_command("seed_restrictions", stdout=StringIO())

        self.assertEqual(rule_kinds, ["items"])
        self.assertEqual((refused.status_code, denied.status_code), (400, 403))
        self.assertEqual(self.changed(), [])
