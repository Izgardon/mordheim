"""Live battle state characterised: config, kills, out of action and item use (pass 3, step 0).

Config merges what it is sent and never changes kills or out of action (BUG-44, BATL-TEST-11, fixed) and parses
armour saves when they are entered (BUG-123, fixed). Item use is in test_battle_item_use.py.
"""

from typing import Any

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Henchman, HenchmenGroup, Hero
from apps.warbands.utils.armour_save import ARMOUR_SAVE_ERROR

from .battle_support import BattleTestCase, draft, unit_result


def info(**fields: Any) -> dict[str, Any]:
    """One stored unit_information entry: the defaults the server fills in, with `fields` changed."""
    return {"stats_override": {}, "notes": "", "current_wounds": None, "out_of_action": False, "kill_count": 0} | fields


class BattleConfigTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch", is_leader=True)
        self.novice = Hero.objects.create(warband=self.warband, name="Novice", unit_type="Novice")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.n, self.r = (f"hero:{hero.id}" for hero in (self.abbess, self.novice, self.rat))
        self.battle_id = self.to_active({self.player: [self.a, self.n], self.viewer: [self.r]})

    def config(self, body: dict[str, Any], user: Any = None) -> Any:
        return self.post_as(user or self.player, self.url(self.battle_id, "config"), body)

    def stored_info(self) -> dict[str, Any]:
        stored: dict[str, Any] = self.participant(self.battle_id, self.player).unit_information_json
        return stored

    def test_a_whole_map_from_an_older_client_keeps_kills_and_out_of_action(self):
        # BUG-44, BATL-TEST-11: a stale whole map replaces the editable fields but not the kill or the OOA
        self.ok(self.kill(self.player, self.battle_id, self.a, self.r), 201)
        self.ok(
            self.post_as(
                self.player, self.url(self.battle_id, "unit-ooa"), {"unit_key": self.n, "out_of_action": True}
            ),
            201,
        )
        self.assertEqual(self.stored_info(), {self.a: info(kill_count=1), self.n: info(out_of_action=True)})

        stale = {self.a: {"current_wounds": 1, "kill_count": 0}}  # a wound save built before the kill and the OOA
        self.ok(self.config({"unit_information_json": stale}))

        expected = {self.a: info(current_wounds=1, kill_count=1), self.n: info(out_of_action=True)}
        self.assertEqual(self.stored_info(), expected)
        self.assertEqual(self.event_types(self.battle_id)[-2:], ["unit_kill_recorded", "unit_ooa_set"])

    def test_config_ignores_kill_counts(self):
        # BUG-11 (input half, with BUG-44): kill_count comes from the kill events, never from config
        self.ok(self.config({"unit_information_json": {self.a: {"kill_count": 50000}, self.n: {"kill_count": "x"}}}))
        self.ok(self.config({"unit_information_patch": {self.a: {"kill_count": 7, "out_of_action": True}}}))
        self.assertEqual(self.stored_info(), {})

        self.finish(self.battle_id, [self.warband])
        results = {key: unit_result(key) for key in (self.a, self.n)}
        self.ok(self.finalize(self.player, self.battle_id, draft(results)))
        self.abbess.refresh_from_db()
        self.assertEqual(self.abbess.kills, 0)

    def test_a_patch_changes_only_the_fields_and_units_it_names(self):
        # BUG-44: unit_information_patch merges into what is stored, under the participant's lock
        self.ok(self.kill(self.player, self.battle_id, self.a, self.r), 201)
        self.ok(self.config({"unit_information_patch": {self.a: {"notes": "brave"}, self.n: {"current_wounds": 2}}}))
        self.ok(self.config({"unit_information_patch": {self.a: {"stats_override": {"strength": 4}}}}))

        expected_a = info(notes="brave", stats_override={"strength": 4}, kill_count=1)
        self.assertEqual(self.stored_info(), {self.a: expected_a, self.n: info(current_wounds=2)})

        self.ok(self.config({"unit_information_patch": {self.n: {"current_wounds": None}}}))  # emptied: dropped
        self.assertEqual(self.stored_info(), {self.a: expected_a})
        response = self.config({"unit_information_patch": {}, "unit_information_json": {}})
        detail = "Send unit_information_patch or unit_information_json, not both"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

    def test_config_keeps_what_it_is_not_sent_and_broadcasts_what_others_see(self):
        self.ok(self.config({"unit_information_json": {self.a: {"notes": " wounded "}}}))
        sent = len(self.sent())
        self.ok(self.config({"battle_notes": "  ambush at the bridge  "}))
        self.assertEqual(len(self.sent()), sent)  # PERF-34: notes are the player's own, never broadcast

        self.ok(self.config({"declared_rating": "120"}))

        participant = self.participant(self.battle_id, self.player)
        self.assertEqual(participant.selected_unit_keys_json, [self.a, self.n])
        self.assertEqual(participant.unit_information_json, {self.a: info(notes="wounded")})
        self.assertEqual((participant.battle_notes, participant.declared_rating), ("ambush at the bridge", 120))
        self.assertEqual(self.sent()[sent:], ["battle_state_updated"])
        self.assertEqual(self.battle_events.call_args.args[2]["reason"], "participant_config_updated")

    def test_config_normalises_unit_information(self):
        entry = {
            "stats_override": {"weapon_skill": 14, "strength": -2, "armour_save": " 4+ "},
            "current_wounds": "12",
            "out_of_action": "no",  # ignored like kill_count (BUG-44); BUG-125 stored "no" as true
            "kill_count": "2",
            "unknown": "dropped",
        }
        self.ok(self.config({"unit_information_json": {f" {self.a} ": entry, " ": {}}}))

        expected = info(stats_override={"weapon_skill": 10, "strength": 0, "armour_save": "4+"}, current_wounds=10)
        self.assertEqual(self.stored_info(), {self.a: expected})

    def test_config_validation(self):
        a = self.a
        cases: list[tuple[dict[str, Any], str]] = [
            ({"unit_information_json": []}, "unit_information_json must be an object"),
            ({"unit_information_json": {a: 3}}, "Each unit information entry must be an object"),
            ({"unit_information_json": {a: {"stats_override": []}}}, "unit information stats_override must be an object"),
            ({"unit_information_json": {a: {"stats_override": {"luck": 3}}}}, "Unsupported unit information stat key 'luck'"),
            ({"unit_information_json": {a: {"stats_override": {"strength": "x"}}}}, "unit information stat 'strength' must be an integer"),
            ({"unit_information_json": {a: {"stats_override": {"armour_save": "x" * 21}}}}, f"unit information armour_save: {ARMOUR_SAVE_ERROR}"),
            ({"unit_information_patch": {a: {"stats_override": {"armour_save": "7+"}}}}, f"unit information armour_save: {ARMOUR_SAVE_ERROR}"),
            ({"unit_information_json": {a: {"notes": 5}}}, "unit information notes must be a string"),
            ({"unit_information_json": {a: {"notes": "x" * 501}}}, "unit information notes must be at most 500 characters"),
            ({"unit_information_json": {a: {"current_wounds": "x"}}}, "unit information current_wounds must be an integer"),
            ({"unit_information_patch": []}, "unit_information_patch must be an object"),
            ({"unit_information_patch": {a: None}}, "Each unit information entry must be an object"),
            ({"unit_information_patch": {a: {"current_wounds": "x"}}}, "unit information current_wounds must be an integer"),
            ({"selected_unit_keys_json": a}, "selected_unit_keys_json must be a list"),
            ({"selected_unit_keys_json": [3]}, "selected_unit_keys_json must contain only strings"),
            ({"custom_units_json": [{"key": "orc:1"}]}, "custom unit key must start with 'custom:' or 'bestiary:'"),
        ]  # fmt: skip
        for body, detail in cases:
            with self.subTest(detail=detail):
                response = self.config(body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.stored_info(), {})

    def test_a_bad_declared_rating_is_a_field_error(self):
        # BUG-125: "x" answered Python's int() message; both refusals now name the field
        message = ["Enter a whole number from 0 to 9999, or leave it empty."]
        for rating, detail in (
            ("x", "declared_rating must be a whole number"),
            (10000, "declared_rating must be between 0 and 9999"),
        ):
            with self.subTest(rating=rating):
                response = self.config({"declared_rating": rating})
                expected = {"detail": detail, "code": "invalid", "fields": {"declared_rating": message}}
                self.assertEqual((response.status_code, response.data), (400, expected))
        self.assertIsNone(self.participant(self.battle_id, self.player).declared_rating)

    def test_config_is_locked_outside_prebattle_active_and_postbattle(self):
        for battle_status in (Battle.STATUS_INVITING, Battle.STATUS_ENDED, Battle.STATUS_CANCELED):
            with self.subTest(status=battle_status):
                Battle.objects.filter(id=self.battle_id).update(status=battle_status)
                response = self.config({"battle_notes": "late"})
                self.assertEqual(
                    (response.status_code, response.data), (400, {"detail": "Battle configuration is locked"})
                )

    def test_an_armour_save_is_parsed_when_entered(self):
        # BUG-123: a typo is refused by config (it used to be stored, then made finalise answer 400)
        response = self.config({"unit_information_json": {self.a: {"stats_override": {"armour_save": "7+"}}}})
        detail = f"unit information armour_save: {ARMOUR_SAVE_ERROR}"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.stored_info(), {})

        for entered, stored in ((5, "5+"), ("3", "3+"), (" -1+ ", "-1+"), ("-", "-"), ("", "")):
            with self.subTest(entered=entered):
                patch = {self.a: {"stats_override": {"armour_save": entered}}}
                self.ok(self.config({"unit_information_patch": patch}))
                self.assertEqual(self.stored_info()[self.a]["stats_override"], {"armour_save": stored})

        self.finish(self.battle_id, [self.warband])
        results = {key: unit_result(key) for key in (self.a, self.n)}
        self.ok(self.finalize(self.player, self.battle_id, draft(results)))
        self.abbess.refresh_from_db()
        self.assertIsNone(self.abbess.armour_save)  # "" is no save


class BattleKillAndOoaTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(
            warband=self.warband, name="Abbess", unit_type="Matriarch", is_leader=True, caster="Priest"
        )
        group = HenchmenGroup.objects.create(warband=self.warband, name="Sisters", unit_type="Sister", large=True)
        self.sister = Henchman.objects.create(group=group, name="Sister Ana")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin", large=True)
        self.a, self.s, self.r = f"hero:{self.abbess.id}", f"henchman:{self.sister.id}", f"hero:{self.rat.id}"
        custom = {"key": "custom:dog", "name": "War Dog", "unit_type": "Dog", "stats": {}}
        self.battle_id = self.to_active({self.player: [self.a, self.s], self.viewer: [self.r]})
        body = {"selected_unit_keys_json": [self.a, self.s, "custom:dog"], "custom_units_json": [custom]}
        self.ok(self.post_as(self.player, self.url(self.battle_id, "config"), body))

    def unit(self, key: str, warband_id: int | None, **fields: Any) -> dict[str, Any]:
        kind, raw_id = key.split(":")
        unit_id = int(raw_id) if raw_id.isdigit() else None
        payload = {"unit_key": key, "unit_type": kind, "unit_id": unit_id, "warband_id": warband_id, "name": None}
        return payload | {"is_leader": False, "is_caster": False, "caster_type": None, "is_large": False} | fields

    def test_a_kill_records_both_units_and_counts_on_the_killer(self):
        data = self.ok(
            self.kill(self.player, self.battle_id, self.a, self.r, notes=" clean ", earned_xp="false"), 201
        ).data

        self.assertEqual([event["type"] for event in data["events"]], ["unit_kill_recorded"])
        self.assertEqual(
            data["events"][0]["payload_json"],
            {
                "killer": self.unit(
                    self.a, self.warband.id, name="Abbess", is_leader=True, is_caster=True, caster_type="Priest"
                ),
                "victim": self.unit(self.r, self.rival.id, name="Rat", is_large=True),
                "earned_xp": False,
                "notes": "clean",
            },
        )
        stored = self.participant(self.battle_id, self.player).unit_information_json
        self.assertEqual(stored[self.a]["kill_count"], 1)
        self.assertEqual(self.sent()[-1], "unit_kill_recorded")

    def test_henchmen_custom_units_and_named_victims(self):
        by_henchman = self.ok(self.kill(self.player, self.battle_id, self.s, victim_name=" Ogre "), 201).data
        by_dog = self.ok(self.kill(self.player, self.battle_id, "custom:dog", self.r), 201).data

        self.assertEqual(
            by_henchman["events"][0]["payload_json"],
            {
                "killer": self.unit(self.s, self.warband.id, name="Sister Ana", is_large=True),
                "victim": {"unit_key": None, "unit_type": None, "unit_id": None, "warband_id": None, "name": "Ogre"},
                "earned_xp": True,
            },
        )
        self.assertEqual(
            by_dog["events"][0]["payload_json"]["killer"], self.unit("custom:dog", self.warband.id, name="War Dog")
        )

    def test_kill_validation(self):
        cases: list[tuple[dict[str, Any], str]] = [
            ({"killer_unit_key": None, "victim_name": "x"}, "unit_key must be a string"),
            ({"killer_unit_key": "hero", "victim_name": "x"}, "unit_key must use <type>:<id> format"),
            ({"killer_unit_key": "dragon:1", "victim_name": "x"}, "unit_key type is invalid"),
            ({"killer_unit_key": "hero:x", "victim_name": "x"}, "unit_key id must be an integer"),
            ({"killer_unit_key": "hero:0", "victim_name": "x"}, "unit_key id must be an integer"),
            ({"killer_unit_key": self.a}, "Either victim_unit_key or victim_name is required"),
            ({"killer_unit_key": self.a, "victim_name": 5}, "victim_name must be a string"),
            ({"killer_unit_key": self.a, "victim_name": "x" * 121}, "victim_name must be at most 120 characters"),
            ({"killer_unit_key": self.a, "victim_name": "x", "notes": "x" * 501}, "notes must be at most 500 characters"),
            ({"killer_unit_key": self.a, "victim_name": "x", "earned_xp": "maybe"}, "earned_xp must be true or false"),
            ({"killer_unit_key": self.r, "victim_name": "x"}, "killer_unit_key is not selected for this participant"),
            ({"killer_unit_key": self.a, "victim_unit_key": "hero:999999"}, "victim_unit_key is not selected in this battle"),
        ]  # fmt: skip
        for body, detail in cases:
            with self.subTest(detail=detail):
                response = self.post_as(self.player, self.url(self.battle_id, "unit-kill"), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        ooa = {"unit_key": self.a, "out_of_action": True}
        self.ok(self.post_as(self.player, self.url(self.battle_id, "unit-ooa"), ooa), 201)
        response = self.kill(self.player, self.battle_id, self.a, self.r)
        detail = "Cannot record kills for a unit that is out of action"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

    def test_kills_need_an_active_battle_and_a_player_in_it(self):
        BattleParticipant.objects.filter(battle_id=self.battle_id, user=self.player).update(status="finished_battle")
        response = self.kill(self.player, self.battle_id, self.a, self.r)
        self.assertEqual((response.status_code, response.data), (400, {"detail": "You are not currently in battle"}))
        Battle.objects.filter(id=self.battle_id).update(status=Battle.STATUS_POSTBATTLE)
        response = self.kill(self.player, self.battle_id, self.a, self.r)  # BUG-19: what a phone that slept sees
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Battle is not active"}))

    def test_out_of_action_set_repeat_and_unset(self):
        url = self.url(self.battle_id, "unit-ooa")

        data = self.ok(self.post_as(self.player, url, {"unit_key": self.a, "out_of_action": "true"}), 201).data
        self.assertEqual(
            data["events"][0]["payload_json"],
            {
                "unit": {
                    "unit_key": self.a,
                    "unit_type": "hero",
                    "unit_id": self.abbess.id,
                    "warband_id": self.warband.id,
                },
                "out_of_action": True,
            },
        )
        self.assertEqual(
            self.participant(self.battle_id, self.player).unit_information_json, {self.a: info(out_of_action=True)}
        )

        repeat = self.ok(self.post_as(self.player, url, {"unit_key": self.a, "out_of_action": True}))  # 200, no event
        self.assertEqual(repeat.data["events"], [])

        self.ok(self.post_as(self.player, url, {"unit_key": self.a, "out_of_action": False}), 201)
        self.assertEqual(self.participant(self.battle_id, self.player).unit_information_json, {})  # empty entry dropped
        self.assertEqual(self.event_types(self.battle_id)[-2:], ["unit_ooa_set", "unit_ooa_unset"])

        for body, detail in (
            ({"unit_key": self.r, "out_of_action": True}, "unit_key is not selected for this participant"),
            ({"unit_key": self.a, "out_of_action": "maybe"}, "out_of_action must be true or false"),
            ({"unit_key": "", "out_of_action": True}, "unit_key is required"),
        ):
            with self.subTest(detail=detail):
                response = self.post_as(self.player, url, body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
