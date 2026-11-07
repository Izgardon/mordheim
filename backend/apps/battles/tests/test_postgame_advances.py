"""The post-game (next step 3): advances rolled in the Aftermath are taken at finalise, and the draft keeps the camp's
record and the upkeep ticks."""

from django.test import SimpleTestCase

from apps.battles.validation.postbattle import normalize_postbattle
from apps.warbands.tests.roster_support import HENCHMEN, HERO, RosterTestCase, make_unit


def advance(advance_id: str, at: int, *rolls: int) -> dict:
    return {"id": advance_id, "label": advance_id, "at": at, "rolls": list(rolls)}


class AftermathAdvanceTests(RosterTestCase):
    def test_a_heros_advances_are_taken_on_the_level_ups_the_battle_awarded(self):
        hero = make_unit(HERO, self.warband, strength=3)  # default table: 2, 4, ...
        key = f"hero:{hero.id}"

        answer = self.play_battle({key: 4}, {key: {"advances": [advance("S", 2, 3, 3, 2), advance("Skill", 4, 1, 2)]}})

        hero.refresh_from_db()
        self.assertEqual((hero.strength, hero.level_up), (4, 0))
        self.assertEqual((hero.pending_skills, hero.skills.count()), (1, 0))  # picked later, from the card
        self.assertNotIn("advance_skipped", [warning["code"] for warning in answer.get("warnings", [])])
        # the log writes its dice in capitals (William, 7 Nov 2026: "capitalise")
        rolls = self.warband.logs.filter(feature="advance").order_by("id").values_list("payload", flat=True)
        dice = [(payload["roll1"]["dice"], payload.get("roll2", {}).get("dice")) for payload in rolls]
        self.assertEqual(dice, [("2D6", "D6"), ("2D6", None)])

    def test_a_group_takes_its_advance_once_and_leaves_the_lads_got_talent_for_its_card(self):
        marksmen = make_unit(HENCHMEN, self.warband, weapon_skill=3, members=("Alpha", "Beta"))
        talent = make_unit(HENCHMEN, self.warband, members=("Gamma",))
        keys = [f"henchman:{member.id}" for member in marksmen.henchmen.order_by("id")]
        talent_key = f"henchman:{talent.henchmen.get().id}"
        extra = {key: {"advances": [advance("WS", 2, 3, 4)]} for key in keys}

        self.play_battle(
            {**dict.fromkeys(keys, 2), talent_key: 2}, {**extra, talent_key: {"advances": [advance("LGT", 2, 6, 6)]}}
        )

        marksmen.refresh_from_db()
        talent.refresh_from_db()
        self.assertEqual((marksmen.weapon_skill, marksmen.level_up), (4, 0))
        self.assertEqual(talent.level_up, 1)

    def test_an_advance_without_a_level_up_is_skipped_with_a_warning(self):
        hero = make_unit(HERO, self.warband, toughness=3)
        key = f"hero:{hero.id}"

        answer = self.play_battle({key: 1}, {key: {"advances": [advance("T", 2, 4, 5, 6)]}})

        hero.refresh_from_db()
        self.assertEqual(hero.toughness, 3)
        self.assertIn("advance_skipped", [warning["code"] for warning in answer["warnings"]])


class PostgameDraftTests(SimpleTestCase):
    def test_the_draft_keeps_advances_upkeep_ticks_and_the_camp_record(self):
        draft = normalize_postbattle(
            {
                "upkeep": {"entries": {"hireling:4": {"unit_name": "Grunhilde", "cost": 15, "paid": True}}},
                "unit_results": {"hero:1": {"unit_name": "Aldric", "advances": [advance("Skill", 24, 5, 5)]}},
                "camp": {
                    "veterans": {"dice": [4, 5], "spent": 6},
                    "sold": [{"name": "Wyrdstone", "quantity": 3, "gold": 75}],
                    "recruited": [{"group": "The Dock Rats", "count": 2, "xp": 3}],
                },
            }
        )

        self.assertTrue(draft["upkeep"]["entries"]["hireling:4"]["paid"])
        self.assertEqual(draft["unit_results"]["hero:1"]["advances"], [advance("Skill", 24, 5, 5)])
        self.assertEqual(draft["camp"]["veterans"], {"dice": [4, 5], "spent": 6})
        self.assertEqual(draft["camp"]["recruited"], [{"group": "The Dock Rats", "count": 2, "xp": 3}])
        self.assertNotIn("camp", normalize_postbattle({"unit_results": {}}))

    def test_a_veterans_roll_is_two_dice_and_an_advance_names_a_known_one(self):
        with self.assertRaisesMessage(ValueError, "two dice"):
            normalize_postbattle({"camp": {"veterans": {"dice": [4]}}})
        with self.assertRaisesMessage(ValueError, "advance id is invalid"):
            normalize_postbattle({"unit_results": {"hero:1": {"advances": [advance("Fly", 2)]}}})
