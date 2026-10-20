"""Single-use items used in battle (BUG-72, SEC-09, BATL-TEST-17).

An `item_used` event names a unit of the player's (one he selected, once the battle is active) that carries the item;
its payload is whitelisted, at most 2 KB, and stored with the server's own fields. Finalise or a skip removes one
copy per use.
"""

from typing import Any

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.warbands.models import HenchmenGroup, Hero, HeroItem

from .battle_support import BattleTestCase, catalogue_item, status_changed


class BattleItemUseTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.novice = Hero.objects.create(warband=self.warband, name="Novice", unit_type="Novice")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        for hero in (self.abbess, self.novice, self.rat):
            HeroItem.objects.create(hero=hero, item=self.sword, cost=10)
        self.a, self.n, self.r = (f"hero:{hero.id}" for hero in (self.abbess, self.novice, self.rat))

    def events_url(self, battle_id: int) -> str:
        return self.url(battle_id, "events")

    def refused(self, response: Any, detail: str, code: str = "invalid") -> None:
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual((response.data["detail"], response.data["code"]), (detail, code))

    def test_item_use_is_stored_with_the_servers_own_fields(self):
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        sent = {"participant_user_id": 999, "unit_key": f" {self.a} ", "unit_id": 5, "unit_type": "ogre"}
        sent |= {"item_id": str(self.sword.id), "item_name": "Excalibur"}

        data = self.ok(self.use_item(self.player, battle_id, sent), 201).data

        stored = {"participant_user_id": self.player.id, "unit_key": self.a, "unit_id": self.abbess.id}
        stored |= {"unit_type": "hero", "item_id": self.sword.id, "item_name": "Sword"}
        self.assertEqual((data["events"][0]["type"], data["events"][0]["payload_json"]), ("item_used", stored))
        self.assertEqual(self.sent()[-1], "item_used")
        for body, detail in (
            ({"type": "battle_ended", "payload_json": {}}, "Unsupported event type"),
            ({"type": "item_used", "payload_json": [1]}, "payload_json must be an object"),
        ):
            with self.subTest(detail=detail):
                response = self.post_as(self.player, self.events_url(battle_id), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))

    def test_item_use_in_each_phase(self):
        battle_id = self.to_prebattle()
        use = {"unit_key": self.n, "item_id": self.sword.id}
        self.ok(self.use_item(self.player, battle_id, use), 201)  # prebattle: his own unit, selected or not
        BattleParticipant.objects.filter(battle_id=battle_id, user=self.player).update(status="canceled_prebattle")
        response = self.use_item(self.player, battle_id, use)
        self.assertEqual((response.status_code, response.data), (400, {"detail": "You are not currently in prebattle"}))
        wrong_phase = "Items can only be used in prebattle or active battle"
        for battle_status, body in (
            (Battle.STATUS_ACTIVE, {"detail": "You are not currently in battle"}),
            (Battle.STATUS_INVITING, status_changed(wrong_phase, Battle.STATUS_INVITING)),
            (Battle.STATUS_POSTBATTLE, status_changed(wrong_phase, Battle.STATUS_POSTBATTLE)),
        ):
            with self.subTest(status=battle_status):
                Battle.objects.filter(id=battle_id).update(status=battle_status)
                response = self.use_item(self.player, battle_id, use)
                self.assertEqual((response.status_code, response.data), (400, body))

    def test_item_use_needs_a_selected_unit_of_the_players_that_carries_the_item(self):
        # BUG-72, BATL-TEST-17: another player's unit, an item nobody carries and an empty payload were all stored
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        cases: list[tuple[dict[str, Any], str, str]] = [
            ({"unit_key": self.r, "item_id": self.sword.id}, "unit_key is not selected for this participant", "unit_not_selected"),
            ({"unit_key": self.n, "item_id": self.sword.id}, "unit_key is not selected for this participant", "unit_not_selected"),
            ({"unit_key": self.a, "item_id": self.axe.id}, "That unit doesn't carry this item", "item_not_carried"),
            ({}, "unit_key must name a hero, hired sword or henchman", "invalid"),
            ({"unit_key": "custom:dog", "item_id": self.sword.id}, "unit_key must name a hero, hired sword or henchman", "invalid"),
            ({"unit_key": self.a, "item_id": "x"}, "item_id must be an item's id", "invalid"),
        ]  # fmt: skip
        for payload, detail, code in cases:
            with self.subTest(payload=payload):
                self.refused(self.use_item(self.player, battle_id, payload), detail, code)
        self.assertFalse(BattleEvent.objects.filter(battle_id=battle_id, type="item_used").exists())

    def test_a_henchman_uses_his_groups_item(self):
        group = HenchmenGroup.objects.create(warband=self.warband, name="Sisters", unit_type="Sister")
        sister = group.henchmen.create(name="Ana")
        group.henchmen_group_items.create(item=self.sword, cost=10)
        battle_id = self.to_active({self.player: [f"henchman:{sister.id}"], self.viewer: [self.r]})

        data = self.ok(self.use_item(self.player, battle_id, {"unit_key": f"henchman:{sister.id}", "item_id": self.sword.id}), 201).data  # fmt: skip

        self.assertEqual(data["events"][0]["payload_json"]["unit_type"], "henchman")

    def test_item_use_payloads_are_whitelisted_and_small(self):
        # SEC-09, BATL-TEST-17: a 50 KB payload was stored and replayed on every state read
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        huge = {"unit_key": self.a, "item_id": self.sword.id, "item_name": "x" * 50_000}
        self.refused(
            self.use_item(self.player, battle_id, huge), "payload_json must be at most 2 KB", "payload_too_large"
        )
        extra = {"unit_key": self.a, "item_id": self.sword.id, "note": "hi"}
        self.refused(self.use_item(self.player, battle_id, extra), "payload_json has unsupported keys: note")

        state = self.ok(self.get_as(self.viewer, self.url(battle_id, "state"))).data
        self.assertEqual([event["type"] for event in state["events"]][-1], "battle_started")

    def test_the_winner_endpoint_and_the_legacy_events_are_gone(self):
        # BATL-CQ-04/06, deleted in PR B: winner/ always refused, and kill_recorded and death_recorded were never sent
        battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})
        response = self.post_as(self.player, self.url(battle_id, "winner"), {"winner_warband_ids": [self.warband.id]})
        self.assertEqual(response.status_code, 404)
        for legacy in ("kill_recorded", "death_recorded"):
            with self.subTest(type=legacy):
                body = {"type": legacy, "payload_json": {"killer_unit_type": "hero", "killer_unit_id": 7}}
                response = self.post_as(self.player, self.events_url(battle_id), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": "Unsupported event type"}))


class BattleSkipItemTests(BattleTestCase):
    def test_a_skipped_postbattle_uses_up_the_items_used_in_battle(self):
        # BUG-72: a skip kept every used single-use item; it now removes one copy per use, like finalise
        potion = catalogue_item("Healing Draught", 10, single_use=True)
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        for _ in range(2):
            HeroItem.objects.create(hero=hero, item=potion, cost=10)
        battle_id = self.to_active({self.player: [f"hero:{hero.id}"], self.viewer: []})
        self.ok(self.use_item(self.player, battle_id, {"unit_key": f"hero:{hero.id}", "item_id": potion.id}), 201)
        self.finish(battle_id, [self.warband])

        data = self.ok(self.post_as(self.player, self.url(battle_id, "confirm"))).data

        self.assertEqual(HeroItem.objects.filter(hero=hero, item=potion).count(), 1)
        self.assertEqual(
            data["events"][0]["payload_json"], {"participant_user_id": self.player.id, "skipped_postbattle": True}
        )
        self.assertEqual(
            self.participant(battle_id, self.player).postbattle_json,
            {
                "exploration": {"dice_values": [], "resource_id": None},
                "finds": {"gold_crowns": 0, "items": []},
                "upkeep": {"pay_upkeep": True, "entries": {}},
                "unit_results": {},
            },
        )
