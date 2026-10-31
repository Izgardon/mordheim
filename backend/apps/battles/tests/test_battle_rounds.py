"""Rounds, shared status, neutral groups and kills that take their victim out of action (next step 6).

`POST round/ {action}` asks for the next round, agrees, forces it or withdraws the request; the round goes up once
everyone still fighting has agreed, and the new round stands every knocked down model up and knocks every stunned
one down, on the server. A unit's status rides its unit information (`status`, through config/), so the other
players see it. `neutral-groups/` adds creatures nobody plays, which `neutral-creatures/<key>/` changes and a kill can
name as its victim (`victim_neutral_key`). A kill in the fight puts its victim out of action, and undoing it puts him
back. Kills and out-of-action events carry their round, which the pivotal moments carry (next step 9).
"""

from apps.warbands.models import Hero

from .battle_support import BattleTestCase


class FightCase(BattleTestCase):
    """An active battle: the player's Abbess against the viewer's Rat."""

    def setUp(self) -> None:
        super().setUp()
        self.abbess = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"
        self.battle_id = self.to_active({self.player: [self.a], self.viewer: [self.r]})

    def round(self, user, action: str, status: int = 200):
        return self.ok(self.post_as(user, self.url(self.battle_id, "round"), {"action": action}), status).data

    def set_status(self, user, unit_key: str, status: str):
        body = {"unit_information_patch": {unit_key: {"status": status}}}
        return self.ok(self.post_as(user, self.url(self.battle_id, "config"), body))


class RoundTests(FightCase):
    def test_the_next_round_starts_once_everyone_agrees_and_stands_models_up(self):
        self.set_status(self.player, self.a, "stunned")
        self.set_status(self.viewer, self.r, "knocked_down")
        self.assertEqual(self.sent()[-1], "battle_state_updated")  # others see a status change

        asked = self.round(self.player, "ask")
        self.assertEqual(asked["battle"]["round_request"], {"round": 2, "asked_by": self.player.id, "agreed": [self.player.id]})  # fmt: skip
        self.assertEqual(asked["battle"]["round"], 1)
        started = self.round(self.viewer, "agree")

        self.assertEqual((started["battle"]["round"], started["battle"]["round_request"]), (2, None))
        self.assertEqual(self.event_types(self.battle_id)[-3:], ["round_requested", "round_agreed", "round_started"])
        self.assertEqual(self.participant(self.battle_id, self.player).unit_information_json[self.a]["status"], "knocked_down")  # fmt: skip
        self.assertNotIn(self.r, self.participant(self.battle_id, self.viewer).unit_information_json)  # stood up
        self.assertEqual(self.sent()[-1], "round_started")

    def test_start_anyway_withdraw_and_agreeing_to_nothing(self):
        self.ok(self.post_as(self.viewer, self.url(self.battle_id, "round"), {"action": "agree"}), 400)
        self.round(self.player, "ask")
        withdrawn = self.round(self.player, "withdraw")
        self.assertIsNone(withdrawn["battle"]["round_request"])

        self.round(self.player, "ask")
        forced = self.round(self.player, "force")
        self.assertEqual(forced["battle"]["round"], 2)
        self.assertEqual(forced["events"][-1]["payload_json"], {"round": 2, "forced": True})
        self.ok(self.post_as(self.player, self.url(self.battle_id, "round"), {"action": "skip"}), 400)

    def test_out_of_action_clears_the_status_and_events_carry_the_round(self):
        self.set_status(self.player, self.a, "stunned")
        self.round(self.player, "force")
        out = self.ok(self.post_as(self.player, self.url(self.battle_id, "unit-ooa"), {"unit_key": self.a, "out_of_action": True}), 201)  # fmt: skip

        self.assertEqual(out.data["events"][0]["payload_json"]["round"], 2)
        self.assertNotIn("status", self.participant(self.battle_id, self.player).unit_information_json[self.a])

    def test_a_kill_takes_its_victim_out_of_action_and_undoing_it_puts_him_back(self):
        killed = self.ok(self.kill(self.player, self.battle_id, self.a, self.r, how="shooting"), 201).data
        event = killed["events"][0]
        payload = event["payload_json"]
        self.assertEqual((payload["victim_ooa"], payload["round"], payload["how"]), (True, 1, "shooting"))
        self.ok(self.kill(self.player, self.battle_id, self.a, self.r, how="sorcery"), 400)
        self.assertTrue(self.participant(self.battle_id, self.viewer).unit_information_json[self.r]["out_of_action"])

        self.ok(self.post_as(self.player, self.url(self.battle_id, f"events/{event['id']}/void")))
        self.assertNotIn(self.r, self.participant(self.battle_id, self.viewer).unit_information_json)


class NeutralGroupTests(FightCase):
    def add_zombies(self, count: int = 3):
        body = {"name": "Zombies", "creature_type": "Zombie", "count": count, "wounds": 1, "stats": {"movement": 4}}
        return self.ok(self.post_as(self.viewer, self.url(self.battle_id, "neutral-groups"), body), 201).data

    def test_anyone_in_the_fight_adds_a_group_of_numbered_creatures(self):
        data = self.add_zombies()
        (group,) = data["battle"]["neutral_groups"]

        self.assertEqual([creature["name"] for creature in group["creatures"]], ["Zombie 1", "Zombie 2", "Zombie 3"])
        self.assertEqual(group["creatures"][0], {"key": "n1-1", "name": "Zombie 1", "status": "standing", "wounds": 1})
        self.assertEqual(group["stats"], {"movement": 4})
        more = self.ok(self.post_as(self.player, self.url(self.battle_id, "neutral-groups/n1"), {"add": True}), 201)
        self.assertEqual(more.data["battle"]["neutral_groups"][0]["creatures"][-1]["name"], "Zombie 4")
        self.ok(self.post_as(self.player, self.url(self.battle_id, "neutral-groups"), {"name": ""}), 400)

    def test_creatures_take_status_and_wounds_and_stand_up_with_the_round(self):
        self.add_zombies(1)
        url = self.url(self.battle_id, "neutral-creatures/n1-1")
        self.ok(self.post_as(self.player, url, {"status": "stunned", "wounds": 0}))
        self.ok(self.post_as(self.player, url, {"status": "asleep"}), 400)
        self.round(self.player, "force")

        creature = self.battle(self.battle_id).neutral_groups_json[0]["creatures"][0]
        self.assertEqual((creature["name"], creature["status"], creature["wounds"]), ("Zombie", "knocked_down", 0))

    def test_a_creature_can_be_killed_and_brought_back_by_an_undo(self):
        self.add_zombies(2)
        killed = self.ok(self.kill(self.player, self.battle_id, self.a, victim_neutral_key="n1-2"), 201).data
        victim = killed["events"][0]["payload_json"]["victim"]

        self.assertEqual((victim["name"], victim["type_name"], victim["neutral_key"]), ("Zombie 2", "Zombie", "n1-2"))
        self.assertEqual(killed["battle"]["neutral_groups"][0]["creatures"][1]["status"], "out_of_action")
        self.ok(self.post_as(self.player, self.url(self.battle_id, f"events/{killed['events'][0]['id']}/void")))
        self.assertEqual(self.battle(self.battle_id).neutral_groups_json[0]["creatures"][1]["status"], "standing")
        missing = self.kill(self.player, self.battle_id, self.a, victim_neutral_key="n9-9")
        self.assertEqual(missing.status_code, 404)
