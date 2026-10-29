"""Missing games (edit mode): a unit out for a number of the warband's battles, with an optional reason.

Heroes, hired swords and dramatis personae, and henchmen groups (the whole group) are set missing through their
update (PATCH, or an update entry of the roster's batch Save); 0 brings the unit back early. Setting it writes
"<name> misses 2 games: <reason>" to the log and bringing it back "<name> returns". A dead unit can't be set
missing, and one that dies is missing no more. A missing unit stays on the roster: it counts towards warband size
and the caps, but the rating leaves it out. Setting or clearing it sends `warband.changed`, so other members' open
pages of the warband follow.
"""

from decimal import Decimal
from typing import Any
from unittest import mock

from django.test import override_settings

from apps.warbands.models import Hero, Hireling, WarbandLog
from apps.warbands.services.summary import load_warband_units

from .roster_support import HENCHMEN, HERO, HIRELING, KINDS, Kind, RosterTestCase, make_unit, unit_url

SOCKET = "123.456"


def missing_logs(unit_name: str) -> list[tuple[str, dict[str, Any]]]:
    rows = WarbandLog.objects.filter(feature="personnel", entry_type__in=("unit_missing", "unit_returns"))
    return [(row.entry_type, row.payload) for row in rows.order_by("id") if row.payload.get("name") == unit_name]


class MissingGamesEditTests(RosterTestCase):
    def patch(self, kind: Kind, unit: Any, body: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(kind, self.warband.id, unit.id), body, format="json")

    def test_every_kind_can_be_set_missing_with_a_reason_and_it_is_logged(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, name=f"Pieter {kind.key}")

                response = self.patch(kind, unit, {"missing_games": 2, "missing_reason": "Deep wound"})

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual((response.data["missing_games"], response.data["missing_reason"]), (2, "Deep wound"))
                payload = {"name": unit.name, "games": 2, "reason": "Deep wound"}
                self.assertEqual(missing_logs(unit.name), [("unit_missing", payload)])

    def test_clearing_brings_the_unit_back_early_and_forgets_the_reason(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, name=f"Back {kind.key}", missing_games=2, missing_reason="Lost")

                response = self.patch(kind, unit, {"missing_games": 0})

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual((response.data["missing_games"], response.data["missing_reason"]), (0, ""))
                self.assertEqual(missing_logs(unit.name), [("unit_returns", {"name": unit.name})])

    def test_a_new_count_or_reason_is_logged_again_and_an_unchanged_one_is_not(self):
        hero = make_unit(HERO, self.warband, name="Aldric", missing_games=2, missing_reason="Captured")

        self.patch(HERO, hero, {"missing_games": 2, "missing_reason": "Captured", "name": "Aldric"})
        self.patch(HERO, hero, {"xp": 3})
        self.patch(HERO, hero, {"missing_games": 3})

        self.assertEqual(
            missing_logs("Aldric"), [("unit_missing", {"name": "Aldric", "games": 3, "reason": "Captured"})]
        )

    def test_the_rosters_batch_save_sets_and_clears_missing_games(self):
        out, back = (
            make_unit(HERO, self.warband, name="Out"),
            make_unit(HERO, self.warband, name="Back", missing_games=1),
        )
        body = {"update": [{"id": out.id, "missing_games": 1}, {"id": back.id, "missing_games": 0}]}

        response = self.client.post(unit_url(HERO, self.warband.id, suffix="batch/"), body, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        missing = {unit["name"]: unit["missing_games"] for unit in response.data["units"]}
        self.assertEqual(missing, {"Out": 1, "Back": 0})
        self.assertEqual(missing_logs("Out"), [("unit_missing", {"name": "Out", "games": 1, "reason": ""})])
        self.assertEqual(missing_logs("Back"), [("unit_returns", {"name": "Back"})])

    def test_a_dead_unit_cant_be_set_missing_and_one_that_dies_is_missing_no_more(self):
        hero = make_unit(HERO, self.warband, name="Doomed")

        refused = self.patch(HERO, hero, {"dead": True, "missing_games": 2})
        died = self.patch(HERO, make_unit(HERO, self.warband, name="Gone", missing_games=2), {"dead": True})

        self.assertEqual(refused.status_code, 400)
        self.assertIn("missing_games", refused.json())  # a PATCH answers DRF's field errors
        self.assertEqual(Hero.objects.get(id=hero.id).missing_games, 0)
        self.assertEqual(died.status_code, 200, died.data)
        self.assertEqual(Hero.objects.get(name="Gone").missing_games, 0)

    def test_missing_games_run_from_0_to_99_and_the_reason_to_120_characters(self):
        hero = make_unit(HERO, self.warband, name="Bounded")
        for body in ({"missing_games": -1}, {"missing_games": 100}, {"missing_reason": "x" * 121}):
            with self.subTest(body=body):
                response = self.patch(HERO, hero, body)
                self.assertEqual(response.status_code, 400)
                self.assertIn(next(iter(body)), response.json())

    def test_only_editors_set_missing_games(self):
        hero = make_unit(HERO, self.warband, name="Guarded")
        self.client.force_authenticate(user=self.viewer)

        response = self.patch(HERO, hero, {"missing_games": 2})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Hero.objects.get(id=hero.id).missing_games, 0)

    def test_unit_payloads_say_how_many_games_and_why(self):
        group = make_unit(HENCHMEN, self.warband, name="Swords", missing_games=1, missing_reason="Hiding")

        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).json()

        shown = next(entry for entry in sheet["henchmen_groups"] if entry["id"] == group.id)
        self.assertEqual((shown["missing_games"], shown["missing_reason"]), (1, "Hiding"))
        self.assertEqual((listed[0]["missing_games"], listed[0]["missing_reason"]), (1, "Hiding"))


class MissingGamesRatingTests(RosterTestCase):
    def test_missing_units_leave_the_rating_but_count_towards_warband_size_and_the_caps(self):
        Hero.objects.create(warband=self.warband, name="Here", xp=Decimal("10"))
        Hero.objects.create(warband=self.warband, name="Away", xp=Decimal("30"), missing_games=2)
        make_unit(HENCHMEN, self.warband, members=("A", "B"), xp=Decimal("1"), missing_games=1)
        Hireling.objects.create(warband=self.warband, name="Ranger", rating=18, blood_pacted=True, missing_games=1)

        units = load_warband_units([self.warband.id])[self.warband.id]

        self.assertEqual(units.rating, 5 + 10)  # only the hero who is here
        # warband size: both heroes, both henchmen and the blood-pacted hired sword; the hero cap: both heroes
        self.assertEqual((units.unit_count, units.hero_count), (2 + 2 + 1, 2))
        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual((summary["rating"], sheet["summary"]["rating"]), (15, 15))
        self.assertEqual(summary["unit_count"], 5)


@override_settings(EXTERNAL_DISPATCH_SYNC=True)
class MissingGamesRealtimeTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.pusher = mock.Mock()
        patcher = mock.patch("apps.realtime.services.get_pusher_client", return_value=self.pusher)
        patcher.start()
        self.addCleanup(patcher.stop)

    def changed(self) -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
        sent = [
            (call.args[0], call.args[2], call.kwargs)
            for call in self.pusher.trigger.call_args_list
            if call.args[1] == "warband.changed"
        ]
        self.pusher.reset_mock()
        return sent

    def write(self, method: str, url: str, body: dict[str, Any]) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            send = getattr(self.client, method)
            return send(url, body, format="json", HTTP_X_PUSHER_SOCKET_ID=SOCKET)

    def test_setting_or_clearing_missing_games_tells_the_other_members_and_other_edits_do_not(self):
        hero = make_unit(HERO, self.warband, name="Aldric")
        url = unit_url(HERO, self.warband.id, hero.id)
        batch = unit_url(HIRELING, self.warband.id, suffix="batch/")
        sword = make_unit(HIRELING, self.warband, name="Grukk")
        event = [
            (f"private-campaign-{self.campaign.id}-events", {"warband_id": self.warband.id}, {"socket_id": SOCKET})
        ]

        self.write("patch", url, {"missing_games": 2})
        set_missing = self.changed()
        self.write("patch", url, {"name": "Aldric the Bold", "missing_games": 2})
        renamed = self.changed()
        self.write("post", batch, {"update": [{"id": sword.id, "missing_games": 1}]})
        batched = self.changed()

        self.assertEqual((set_missing, renamed, batched), (event, [], event))
