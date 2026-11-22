"""The aftermath applies each step as the player leaves it (William, 18 Nov 2026: "when they are navigated through
via the next button it should lock in and confirm any result on a previous page immediately, as soon as the next
button is clicked on the exploration page that aftermath stage is complete for that player and they shouldn't be
prompted anymore"; services/postbattle/steps.py).

Pressing Next writes that step's results to the warband there and then, once: a second press writes nothing. What
left the aftermath is locked (the gold and items found), and everything else may still be changed, with a warning
that it only changes the battle's record. Ready then applies whatever is left of the aftermath, charges upkeep and
counts this battle off the units missing games, as it always did.
"""

from decimal import Decimal
from typing import Any

from apps.warbands.models import Hero, LedgerAction, WarbandItem, WarbandResource, WarbandTrade

from .battle_support import BattleTestCase, catalogue_item, draft, unit_result

STEP = "postbattle-step"


class AftermathStepTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.rope = catalogue_item("Rope", 5)
        self.hero = Hero.objects.create(warband=self.warband, name="Ott", unit_type="Captain", is_leader=True)
        self.rat = Hero.objects.create(warband=self.rival, name="Rat", unit_type="Assassin")
        self.h, self.r = f"hero:{self.hero.id}", f"hero:{self.rat.id}"
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=0, is_default=True)
        self.gold = self.warband.gold
        self.battle_id = self.to_active({self.player: [self.h], self.viewer: [self.r]})
        answer = self.kill(self.player, self.battle_id, self.h, self.r)  # a kill of his own, so it can be double-paid
        self.assertIn(answer.status_code, (200, 201), getattr(answer, "data", None))
        self.finish(self.battle_id, [self.warband])

    # the pages' writes

    def body(self, step: str, *, xp: int = 0, dead: bool = False, **sections: Any) -> dict[str, Any]:
        results = {self.h: unit_result(self.h, xp=xp, dead=dead, name="Ott")}
        return {"step": step, "postbattle_json": draft(results, **sections)}

    def press_next(self, step: str, **fields: Any) -> Any:
        return self.post_as(self.player, self.url(self.battle_id, STEP), self.body(step, **fields))

    def save(self, **fields: Any) -> Any:
        body = self.body("injuries", **fields)
        return self.post_as(self.player, self.url(self.battle_id, "postbattle"), body)

    def explored(self, gold: int = 20, shards: int = 2) -> dict[str, Any]:
        """The explore step as the page sends it: the dice, the shards they found and the gold and item found."""
        return {
            "exploration": {"dice_values": [1, 2], "resource_id": self.shards.id, "amount_override": shards},
            "finds": {"gold_crowns": gold, "items": [{"item_id": self.rope.id, "name": "Rope", "type": "Misc"}]},
        }

    # reading back

    def warnings(self, response: Any) -> list[str]:
        return [warning["code"] for warning in self.ok(response).data.get("warnings", [])]

    def aftermath(self) -> dict[str, Any]:
        stored: dict[str, Any] = self.participant(self.battle_id, self.player).postbattle_json["aftermath"]
        return stored

    def stashed(self) -> int:
        rows = WarbandItem.objects.filter(warband=self.warband, item=self.rope)
        return sum(row.quantity for row in rows)

    def rewards(self) -> list[int]:
        rows = WarbandTrade.objects.filter(warband=self.warband, action=LedgerAction.REWARD)
        return list(rows.order_by("id").values_list("price", flat=True))

    # the steps

    def test_next_on_the_injuries_step_applies_it_once_however_often_it_is_pressed(self):
        self.ok(self.press_next("injuries"))

        self.hero.refresh_from_db()
        self.assertEqual((self.hero.kills, self.hero.xp), (1, Decimal(0)))  # his kill; the XP waits for its own step
        self.assertEqual(self.aftermath()["applied"], ["injuries"])

        self.ok(self.press_next("injuries"))  # he came back to the step and left it again

        self.hero.refresh_from_db()
        self.assertEqual(self.hero.kills, 1)  # not paid twice
        self.assertEqual(self.aftermath()["applied"], ["injuries"])

    def test_next_on_the_experience_step_applies_the_xp_once(self):
        self.ok(self.press_next("xp", xp=3))

        self.hero.refresh_from_db()
        self.assertEqual((self.hero.xp, self.hero.kills), (Decimal(3), 0))  # the kill waits for the injuries step

        self.ok(self.press_next("xp", xp=3))

        self.hero.refresh_from_db()
        self.assertEqual(self.hero.xp, Decimal(3))
        self.assertEqual(self.aftermath()["applied"], ["xp"])

    def test_next_on_the_explore_step_hands_over_the_shards_gold_and_items_once_and_finishes_the_aftermath(self):
        self.ok(self.press_next("explore", **self.explored()))

        self.shards.refresh_from_db()
        self.warband.refresh_from_db()
        self.assertEqual((self.shards.amount, self.warband.gold), (2, self.gold + 20))
        self.assertEqual(self.rewards(), [20])
        self.assertEqual(self.stashed(), 1)
        after = self.aftermath()
        self.assertEqual(after["applied"], ["explore"])
        self.assertIsNotNone(after["done_at"])  # his aftermath is done: he is not prompted for it again
        self.assertEqual(after["received"], {"shards": 2, "resource": "Wyrdstone", "gold": 20, "items": 1})

        self.ok(self.press_next("explore", **self.explored()))

        self.shards.refresh_from_db()
        self.warband.refresh_from_db()
        self.assertEqual((self.shards.amount, self.warband.gold, self.rewards()), (2, self.gold + 20, [20]))
        self.assertEqual(self.stashed(), 1)

    def test_an_unknown_step_is_refused(self):
        answer = self.press_next("camp")

        self.assertEqual(answer.status_code, 400, answer.data)
        self.assertEqual(answer.data["code"], "unknown_step")

    # what may be changed afterwards

    def test_the_gold_and_items_found_are_locked_once_handed_over_and_say_where_to_change_them(self):
        self.ok(self.press_next("explore", **self.explored()))

        answer = self.save(**self.explored(gold=90))

        self.assertEqual(answer.status_code, 400, answer.data)
        self.assertEqual(answer.data["code"], "aftermath_locked")
        self.assertIn("already in your warband", answer.data["detail"])
        self.assertIn("stash", answer.data["detail"])
        self.warband.refresh_from_db()
        self.assertEqual((self.warband.gold, self.rewards()), (self.gold + 20, [20]))
        # and the same through Next, for a player who edits the step and presses it again
        self.assertEqual(self.press_next("explore", **self.explored(gold=90)).status_code, 400)

    def test_an_item_taken_off_the_finds_is_locked_too(self):
        self.ok(self.press_next("explore", **self.explored()))
        sections = self.explored()
        sections["finds"]["items"] = []

        answer = self.save(**sections)

        self.assertEqual(answer.status_code, 400, answer.data)
        self.assertEqual(answer.data["code"], "aftermath_locked")

    def test_the_injuries_and_xp_stay_editable_and_warn_that_they_only_change_the_record(self):
        self.ok(self.press_next("injuries"))
        self.ok(self.press_next("xp", xp=3))

        answer = self.ok(self.save(xp=5, dead=True))

        codes = [warning["code"] for warning in answer.data["warnings"]]
        self.assertEqual(codes.count("aftermath_already_applied"), 2)  # the injuries', and the experience's
        messages = [
            warning["message"] for warning in answer.data["warnings"] if warning["code"] == "aftermath_already_applied"
        ]
        self.assertTrue(all("only changes the battle's record" in message for message in messages), messages)
        self.assertTrue(any("Change a unit on their card" in message for message in messages), messages)
        self.hero.refresh_from_db()
        self.assertEqual((self.hero.xp, self.hero.dead), (Decimal(3), False))  # the record changed, not the warband

    def test_the_exploration_dice_may_be_changed_after_the_step_with_a_warning(self):
        self.ok(self.press_next("explore", **self.explored()))
        sections = self.explored()
        sections["exploration"]["dice_values"] = [4, 4]

        warnings = self.warnings(self.save(**sections))

        self.assertIn("aftermath_already_applied", warnings)
        self.assertIn("exploration_rerolled", warnings)
        self.shards.refresh_from_db()
        self.assertEqual(self.shards.amount, 2)  # the shards received stay as they are
        stored = self.participant(self.battle_id, self.player).postbattle_json
        self.assertEqual(stored["exploration"]["dice_values"], [4, 4])  # the record followed

    # Ready

    def test_ready_applies_only_what_is_left_of_the_aftermath_and_charges_the_upkeep(self):
        for step, fields in (("injuries", {}), ("xp", {"xp": 3}), ("explore", self.explored())):
            self.ok(self.press_next(step, **fields))

        answer = self.finalize(self.player, self.battle_id, draft({self.h: unit_result(self.h, xp=3, name="Ott")}))

        self.ok(answer)
        self.hero.refresh_from_db()
        self.warband.refresh_from_db()
        self.assertEqual((self.hero.xp, self.hero.kills), (Decimal(3), 1))  # nothing applied twice
        self.assertEqual((self.warband.gold, self.rewards()), (self.gold + 20, [20]))
        self.assertEqual(self.participant(self.battle_id, self.player).status, "confirmed_postbattle")
        self.assertEqual(self.aftermath()["applied"], ["injuries", "xp", "explore"])

    def test_ready_still_applies_the_whole_aftermath_for_a_player_who_pressed_no_next(self):
        answer = self.finalize(
            self.player,
            self.battle_id,
            draft({self.h: unit_result(self.h, xp=3, name="Ott")}, **self.explored()),
        )

        self.ok(answer)
        self.hero.refresh_from_db()
        self.shards.refresh_from_db()
        self.warband.refresh_from_db()
        self.assertEqual((self.hero.xp, self.hero.kills), (Decimal(3), 1))
        self.assertEqual((self.shards.amount, self.warband.gold), (2, self.gold + 20))
        self.assertEqual(self.aftermath()["applied"], ["injuries", "xp", "explore"])

    def test_skipping_the_aftermath_keeps_what_was_already_applied(self):
        self.ok(self.press_next("xp", xp=3))

        self.ok(self.post_as(self.player, self.url(self.battle_id, "skip-postbattle")))

        self.hero.refresh_from_db()
        participant = self.participant(self.battle_id, self.player)
        self.assertEqual(self.hero.xp, Decimal(3))  # his experience stays: it is in the warband
        self.assertEqual(participant.postbattle_json["unit_results"][self.h]["xp_earned"], 3)  # and its record
        self.assertEqual(participant.status, "confirmed_postbattle")
