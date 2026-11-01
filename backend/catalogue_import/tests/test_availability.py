from typing import Any

from django.test import SimpleTestCase

from catalogue_import.availability import mordheimer_rows
from catalogue_import.tests.world import world


def item(**fields: Any) -> dict[str, Any]:
    return {"name": "Thing", "availability": 8, "cost": {"cost": 20}, **fields}


class PriceRowTests(SimpleTestCase):
    def setUp(self) -> None:
        _types, _resolver, _groups, self.ctx = world()

    def test_everyone_minus_an_exclusion_that_is_a_group(self) -> None:
        excluded = ["Witch Hunters", "Sisters of Sigmar"]
        rows = mordheimer_rows(item(permittedWarbands="all", excludedWarbands=excluded), self.ctx)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["for_everyone"])
        self.assertEqual(rows[0]["warbands"], [{"group": "sigmarite", "excluded": True}])

    def test_a_list_that_is_not_a_group_names_the_types(self) -> None:
        rows = mordheimer_rows(item(permittedWarbands=["Witch Hunters", "Reiklanders"]), self.ctx)
        self.assertFalse(rows[0]["for_everyone"])
        self.assertEqual(
            rows[0]["warbands"],
            [{"type": "witch-hunters", "excluded": False}, {"type": "reiklanders", "excluded": False}],
        )

    def test_a_brace_price_is_its_own_row(self) -> None:
        pistol = item(permittedWarbands="all", cost={"cost": 15, "braceCost": {"cost": 30}})
        rows = mordheimer_rows(pistol, self.ctx)
        self.assertEqual([(row["label"], row["cost"], row["rarity"]) for row in rows], [("", 15, 8), ("Brace", 30, 8)])

    def test_override_rows_follow_the_note_when_they_disagree(self) -> None:
        names = ("Forest Goblins", "Lizardmen", "Skaven")
        blowpipe = item(
            availability=7,
            permittedWarbands=["Skaven", "Forest Goblins", "Lizardmen"],
            warbandRarityOverride=[{"warband": name, "availability": 0} for name in names],
            rulesCaveat="Skaven, Lizardmen and Forest Goblins only. Common for Forest Goblins.",
        )
        rows = mordheimer_rows(blowpipe, self.ctx)
        self.assertEqual(
            [(row["rarity"], [entry["type"] for entry in row["warbands"]]) for row in rows],
            [(7, ["skaven", "forest-goblins", "lizardmen"]), (None, ["forest-goblins"])],
        )
        self.assertEqual(rows[0]["note"], "")
        self.assertEqual([conflict["item"] for conflict in self.ctx.conflicts], ["Thing"])

    def test_an_override_for_an_excluded_warband_is_dropped(self) -> None:
        overrides = [{"warband": "Skaven", "availability": 7}, {"warband": "Witch Hunters", "availability": 7}]
        lotus = item(
            permittedWarbands="all",
            excludedWarbands=["Witch Hunters"],
            warbandRarityOverride=overrides,
            rulesCaveat="Rare 7 for Skaven, 10 gc and Common For Skink Heroes",
        )
        rows = mordheimer_rows(lotus, self.ctx)
        self.assertEqual(rows[1]["warbands"], [{"type": "skaven", "excluded": False}])
        skinks = rows[2]
        self.assertEqual((skinks["label"], skinks["cost"], skinks["rarity"]), ("Skink heroes", 10, None))
        self.assertEqual(skinks["warbands"], [{"type": "lizardmen", "excluded": False}])

    def test_who_statements_leave_the_note_and_unit_limits_stay(self) -> None:
        kit = item(permittedWarbands=["Reiklanders"], caveat="Reiklander ", modelCaveat="Heroes only")
        rows = mordheimer_rows(kit, self.ctx)
        self.assertEqual(rows[0]["note"], "Heroes only")
        self.assertEqual(self.ctx.conflicts, [])

    def test_a_note_naming_the_owner_keeps_only_the_unit(self) -> None:
        rows = mordheimer_rows(item(permittedWarbands=["Skaven"], caveat="Skaven Assassin only"), self.ctx)
        self.assertEqual(rows[0]["note"], "Assassin only")

    def test_nobody_may_buy_but_the_note_names_a_warband(self) -> None:
        rows = mordheimer_rows(item(excludedWarbands="all", caveat="Pit Fighters only"), self.ctx)
        self.assertEqual(rows[0]["warbands"], [{"type": "pit-fighters", "excluded": False}])

    def test_nobody_may_buy_a_setting_item_defaults_to_everyone(self) -> None:
        rows = mordheimer_rows(item(excludedWarbands="all", campaignSetting="khemri"), self.ctx)
        self.assertTrue(rows[0]["for_everyone"])
        self.assertEqual(len(self.ctx.conflicts), 1)

    def test_overrides_name_who_may_buy_and_settle_the_contradiction(self) -> None:
        self.ctx.chosen["Thing"] = (["skaven"], "on the Skaven list")
        rows = mordheimer_rows(item(excludedWarbands="all", campaignSetting="khemri"), self.ctx)
        self.assertFalse(rows[0]["for_everyone"])
        self.assertEqual(rows[0]["warbands"], [{"type": "skaven", "excluded": False}])
        self.assertEqual(
            [conflict["default"] for conflict in self.ctx.conflicts],
            ["only Skaven, set in overrides.json (on the Skaven list)"],
        )

    def test_types_added_in_overrides_join_the_list_and_settle_the_contradiction(self) -> None:
        self.ctx.added["Thing"] = (["witch-hunters"], "the list predates them")
        rows = mordheimer_rows(item(permittedWarbands=["Reiklanders"], caveat="Humans only"), self.ctx)
        self.assertEqual(
            rows[0]["warbands"],
            [{"type": "witch-hunters", "excluded": False}, {"type": "reiklanders", "excluded": False}],
        )
        self.assertEqual(
            [(conflict["default"], conflict["settled"]) for conflict in self.ctx.conflicts],
            [("the list plus Witch Hunters, set in overrides.json (the list predates them)", "set")],
        )

    def test_an_exclusion_list_from_overrides_is_the_only_one(self) -> None:
        self.ctx.exclusions["Thing"] = (["witch-hunters", "sisters-of-sigmar"], "as its note says")
        tome = item(
            permittedWarbands="all",
            excludedWarbands=["Witch Hunters", "Sisters of Sigmar", "Skaven"],
            caveat="Not available to Witch Hunters or Sisters of Sigmar",
        )
        rows = mordheimer_rows(tome, self.ctx)
        self.assertTrue(rows[0]["for_everyone"])
        self.assertEqual(rows[0]["warbands"], [{"group": "sigmarite", "excluded": True}])
        self.assertEqual(
            self.ctx.conflicts[0]["default"],
            "everyone except Sisters of Sigmar, Witch Hunters, set in overrides.json (as its note says)",
        )

    def test_a_kept_default_stands_and_reads_as_settled(self) -> None:
        self.ctx.kept["Thing"] = "the unarmed attack"
        self.assertEqual(mordheimer_rows(item(excludedWarbands="all", cost=None, availability=""), self.ctx), [])
        self.assertEqual(
            [(conflict["default"], conflict["settled"]) for conflict in self.ctx.conflicts],
            [
                (
                    'no warbands listed ("not usually available" to all), kept in overrides.json (the unarmed attack)',
                    "kept",
                )
            ],
        )

    def test_a_kept_default_with_nothing_to_keep_is_reported(self) -> None:
        self.ctx.kept["Thing"] = "stale"
        mordheimer_rows(item(permittedWarbands="all"), self.ctx)
        self.assertEqual(
            [(conflict["issue"], conflict["settled"]) for conflict in self.ctx.conflicts],
            [("overrides.json keeps its default, but nothing disagrees", "")],
        )

    def test_nothing_to_buy_gives_no_rows(self) -> None:
        self.assertEqual(mordheimer_rows(item(excludedWarbands="all", cost=None, availability=""), self.ctx), [])

    def test_purchase_limit_is_a_soft_note(self) -> None:
        limited = item(permittedWarbands="all", purchaseLimit={"type": "perWarband", "max": 1})
        self.assertEqual(mordheimer_rows(limited, self.ctx)[0]["note"], "max one per warband")
