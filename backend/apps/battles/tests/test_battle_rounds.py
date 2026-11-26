"""Rounds, shared status, neutral groups and kills that take their victim out of action (next step 6).

`POST round/ {action}` asks for the next round, agrees, forces it (the creator or a battle manager: William) or
withdraws the request; the round goes up once everyone still fighting has agreed, and the new round stands every
knocked down model up and knocks every stunned one down, on the server. A unit's status rides its unit information (`status`, through config/), so the other
players see it. `neutral-groups/` adds a named group of creatures nobody plays, filled by its `{add}` with creatures of
any type, which `neutral-creatures/<key>/` changes and a kill can name as its victim (`victim_neutral_key`). A kill in the fight puts its victim out of action, and undoing it puts him
back. Kills and out-of-action events carry their round, which the pivotal moments carry (next step 9).
"""

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission, CampaignPermission
from apps.warbands.models import Hero, Warband

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

    def test_start_anyway_is_the_creators_or_a_battle_managers(self):
        # William: the creator, campaign admins (and owners) and battle managers; the other players ask and agree
        self.round(self.player, "ask")
        refused = self.post_as(self.viewer, self.url(self.battle_id, "round"), {"action": "force"})
        self.assertEqual((refused.status_code, refused.data["code"]), (403, "force_round_not_allowed"))
        self.assertEqual(self.battle(self.battle_id).round, 1)
        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        self.assertFalse(state["capabilities"]["force_round"])
        self.round(self.viewer, "agree")  # asking and agreeing are still everyone's

        membership = CampaignMembership.objects.get(campaign=self.campaign, user=self.viewer)
        permission = CampaignPermission.objects.get(code="manage_battles")
        CampaignMembershipPermission.objects.create(membership=membership, permission=permission)
        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        self.assertTrue(state["capabilities"]["force_round"])
        self.assertEqual(self.round(self.viewer, "force")["battle"]["round"], 3)

    def test_an_admin_in_the_fight_starts_it_anyway(self):
        Warband.objects.create(campaign=self.campaign, user=self.admin, name="Crows")
        self.finish(self.battle_id, [])  # the player's fight is over: he may fight another (one battle at a time)
        battle_id = self.to_active({self.player: [], self.admin: []})
        forced = self.ok(self.post_as(self.admin, self.url(battle_id, "round"), {"action": "force"})).data
        self.assertEqual((forced["battle"]["round"], forced["capabilities"]["force_round"]), (2, True))

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
    def add_group(self, name: str = "Zombies"):
        return self.ok(self.post_as(self.viewer, self.url(self.battle_id, "neutral-groups"), {"name": name}), 201).data

    def add(self, creature_type: str, count: int, user=None, **more):
        body = {"add": {"creature_type": creature_type, "count": count, "wounds": 1, **more}}
        return self.post_as(user or self.viewer, self.url(self.battle_id, "neutral-groups/n1"), body)

    def add_zombies(self, count: int = 3):
        self.add_group()
        return self.ok(self.add("Zombie", count, stats={"movement": 4}), 201).data

    def test_a_group_is_a_name_and_starts_empty(self):
        data = self.add_group("Graveyard")

        self.assertEqual(data["battle"]["neutral_groups"], [{"key": "n1", "name": "Graveyard", "creatures": []}])
        self.assertEqual(data["events"][0]["payload_json"], {"group_key": "n1", "name": "Graveyard", "round": 1})
        self.ok(self.post_as(self.player, self.url(self.battle_id, "neutral-groups"), {"name": ""}), 400)

    def test_anyone_in_the_fight_adds_numbered_creatures_each_with_its_own_type(self):
        data = self.add_zombies()
        (group,) = data["battle"]["neutral_groups"]

        self.assertEqual([creature["name"] for creature in group["creatures"]], ["Zombie 1", "Zombie 2", "Zombie 3"])
        zombie = {"key": "n1-1", "name": "Zombie 1", "creature_type": "Zombie", "stats": {"movement": 4}}
        self.assertEqual(group["creatures"][0], {**zombie, "max_wounds": 1, "status": "standing", "wounds": 1})
        ghoul = self.ok(self.add("Ghoul", 1, user=self.player, wounds=2, stats={"toughness": 4}), 201).data
        creatures = ghoul["battle"]["neutral_groups"][0]["creatures"]
        self.assertEqual(
            [(entry["name"], entry["creature_type"], entry["stats"], entry["max_wounds"]) for entry in creatures[3:]],
            [("Ghoul", "Ghoul", {"toughness": 4}, 2)],
        )
        payload = ghoul["events"][0]["payload_json"]
        self.assertEqual((payload["group_name"], payload["creature_type"], payload["count"]), ("Zombies", "Ghoul", 1))
        more = self.ok(self.add("Zombie", 1), 201).data["battle"]["neutral_groups"][0]["creatures"]
        self.assertEqual([entry["key"] for entry in more][-1], "n1-5")
        self.assertEqual(more[-1]["name"], "Zombie 4")

    def test_a_lone_creature_is_numbered_once_another_of_its_type_joins(self):
        self.add_group()
        self.ok(self.add("Ghoul", 1), 201)
        data = self.ok(self.add("Ghoul", 1), 201).data

        self.assertEqual(
            [entry["name"] for entry in data["battle"]["neutral_groups"][0]["creatures"]], ["Ghoul 1", "Ghoul 2"]
        )

    def test_adding_creatures_is_refused_without_a_type_past_the_most_or_to_no_group(self):
        self.add_group()

        self.ok(self.add("", 1), 400)
        self.ok(self.add("Zombie", 31), 400)
        self.ok(self.add("Zombie", 30), 201)
        full = self.add("Zombie", 1)
        self.assertEqual(full.status_code, 400)
        self.assertEqual(full.data["detail"], "A group holds at most 30 creatures.")
        self.ok(self.post_as(self.viewer, self.url(self.battle_id, "neutral-groups/n1"), {"add": True}), 400)
        missing = self.post_as(
            self.viewer, self.url(self.battle_id, "neutral-groups/n9"), {"add": {"creature_type": "Rat"}}
        )
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(missing.data["detail"], "No such group or creature in this battle.")

    def test_a_battle_holds_at_most_twelve_groups(self):
        for number in range(12):
            self.add_group(f"Group {number}")

        refused = self.ok(self.post_as(self.viewer, self.url(self.battle_id, "neutral-groups"), {"name": "More"}), 400)
        self.assertEqual(
            refused.data, {"detail": "A battle holds at most 12 creature groups.", "code": "too_many_groups"}
        )

    def test_a_group_stored_with_one_type_for_all_is_still_read(self):
        battle = self.battle(self.battle_id)
        creature = {"key": "n1-1", "name": "Rat", "status": "standing", "wounds": 1}
        old = {"key": "n1", "name": "Rats", "creature_type": "Giant Rat", "stats": {"movement": 6}, "max_wounds": 1}
        battle.neutral_groups_json = [{**old, "creatures": [creature]}]
        battle.save(update_fields=["neutral_groups_json"])

        state = self.ok(self.get_as(self.viewer, self.url(self.battle_id, "state"))).data
        (group,) = state["battle"]["neutral_groups"]
        self.assertEqual(group["creatures"][0]["creature_type"], "Giant Rat")
        self.assertEqual(group["creatures"][0]["stats"], {"movement": 6})
        killed = self.ok(self.kill(self.player, self.battle_id, self.a, victim_neutral_key="n1-1"), 201).data
        self.assertEqual(killed["events"][0]["payload_json"]["victim"]["type_name"], "Giant Rat")

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
