"""William's rulings of 12 Nov 2026 on the catalogue data, group by group, against the build's output.

The rulings answer the review's questions document: skills and items that do the same thing under different names
are merged into one row (ours, the other's name dropped), ones whose rules really differ are separated with the
later taking its setting or warband in brackets, three of our own numbers are put right, Mutiny in Marienburg's
items move to the Mordheim setting of their own grade, a few warband types join a price row they were missing, and
two misspelt names are spelt as the rest of the catalogue spells them.
"""

from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.common import load_json
from catalogue_import.sources import OUT


class ReviewRulingsTests(SimpleTestCase):
    """The committed `out/` (which test_build.py pins to a fresh run of build.py)."""

    items: ClassVar[dict[str, dict[str, Any]]]
    skills: ClassVar[dict[str, str]]
    groups: ClassVar[dict[str, list[str]]]
    templates: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.items = {row["name"]: row for row in load_json(OUT / "items.json")}
        cls.skills = {row["name"]: row["description"] for row in load_json(OUT / "skills.json")}
        cls.groups = {row["name"]: row["skills"] for row in load_json(OUT / "skill-groups.json")}
        cls.templates = {row["slug"]: row for row in load_json(OUT / "warband-templates.json")}

    def rows(self, item: str, slug: str) -> list[tuple[Any, ...]]:
        """An item's price rows a warband type may buy from, as (cost, dice, rarity, note)."""
        return [
            (row["cost"], row["dice"], row["rarity"], row["note"])
            for row in self.items[item]["availabilities"]
            if {"type": slug, "excluded": False} in row["warbands"]
        ]

    def specials(self, slug: str, fighter: str) -> list[tuple[str, str]]:
        found = next(row for row in self.templates[slug]["fighters"] if row["name"] == fighter)
        return [(row["name"], row["type"]) for row in found["specials"]]

    # 1. Merges: one row, the other's name dropped

    def test_blending_into_the_sands_is_our_sand_worm(self) -> None:
        self.assertNotIn("Blending into the Sands", self.skills)
        self.assertIn("Sand worm", self.groups["Arabyan Nomads"])
        self.assertIn("Hide in open ground", self.skills["Sand worm"])  # ours, word for word

    def test_no_pain_and_numb_are_our_ignore_pain_with_its_condition_dropped(self) -> None:
        # three names for one rule (a stunned result counts as knocked down): the Lustria warband's No Pain, the
        # Mousillon warband's Numb and our Ignore Pain, whose "only with the Resilient Strength skill" goes
        self.assertEqual([name for name in ("No Pain", "Numb") if name in self.skills], [])
        for group in ("Clan Pestilens (Lustria)", "Clan Pestilens (Mousillon)", "Skaven Clan Pestilens"):
            with self.subTest(group=group):
                self.assertIn("Ignore Pain", self.groups[group])
        text = self.skills["Ignore Pain"]
        self.assertNotIn("Resilient", text)
        self.assertIn("“Stunned” injuries as “Knocked Down.”", text)

    def test_fear_and_the_mousillon_rotten_body_are_our_fearsome(self) -> None:
        self.assertEqual([name for name in ("Fear", "Rotten Body (Mousillon)") if name in self.skills], [])
        for group in ("Clan Pestilens (Lustria)", "Clan Pestilens (Mousillon)"):
            with self.subTest(group=group):
                self.assertIn("Fearsome", self.groups[group])
        self.assertIn("Rotten Body", self.skills)  # ours, the immunity to poisons, keeps the name

    def test_savage_is_one_of_frenzys_names_and_the_black_orcs_keep_their_own(self) -> None:
        frenzy = next(row for row in load_json(OUT / "shared-specials.json")["specials"] if row["name"] == "Frenzy")
        self.assertIn("Savage", frenzy["aliases"])
        for fighter in ("Savage Orc Scarboy", "Savage Orc Boy"):
            with self.subTest(fighter=fighter):
                self.assertIn(("Frenzy", "Psychology"), self.specials("savage-orcs-athel-loren", fighter))
        # the Black Orcs' Savage does far more than frenzy, so it stays theirs
        self.assertIn(("Savage (Orc Nutta)", "Warband - Black Orcs"), self.specials("black-orcs", "Orc Nutta"))

    def test_the_bearcloak_is_our_wolfcloak_reworded_away_from_the_wolf(self) -> None:
        self.assertNotIn("Bearcloak", self.items)
        [rule] = self.items["Wolfcloak"]["rules"]
        for word in ("wolf", "Wolf", "Middenheim"):
            with self.subTest(word=word):
                self.assertNotIn(word, rule["text"])
        self.assertIn("roll equal to or under his Strength on a D6", rule["text"])
        self.assertIn("+1 to his armour saves against all shooting attacks", rule["text"])
        self.assertEqual(self.rows("Wolfcloak", "mazzalupo"), [(10, None, None, "Sheepherders only")])
        shown = {
            (line["item"]["name"], line["shown_as"])
            for row in self.templates["mazzalupo"]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == "Wolfcloak"
        }
        self.assertEqual(shown, {("Wolfcloak", "Bearcloak")})

    def test_the_masters_of_horror_repeater_pistol_is_ours_with_a_price_row(self) -> None:
        self.assertNotIn("Repeater Pistol (Masters of Horror)", self.items)
        self.assertEqual(self.rows("Repeater Pistol", "masters-of-horror"), [(25, 3, None, "Heroes only")])
        lines = {line["item"]["name"] for row in self.templates["masters-of-horror"]["lists"] for line in row["lines"]}
        self.assertIn("Repeater Pistol", lines)

    def test_there_is_one_savage_fury_and_it_serves_both_warbands(self) -> None:
        # William, 12 Nov 2026: "keep as 1 add charm". Ours (the Amazons') already carried the charm, so it is
        # reworded away from the Amazon and the Albion Barbarians learn it; their first-round limit goes with it
        self.assertNotIn("Savage Fury (Albion Barbarians)", self.skills)
        for group in ("Amazons", "Albion Barbarians"):
            with self.subTest(group=group):
                self.assertIn("Savage Fury", self.groups[group])
        text = self.skills["Savage Fury"]
        self.assertNotIn("Amazon", text)
        self.assertEqual(text, "The warrior gains +1 Attack when he charges, and is immune to charm effects and to fear.")  # fmt: skip

    def test_there_is_one_lamp_of_the_djinn_and_it_is_the_one_with_the_tables(self) -> None:
        # two rows at the same 50+2D6 Rare 12: Khemri's with both D6 tables and Mutiny in Marienburg's with no
        # rules at all, folded into Khemri's
        lamps = [row for row in load_json(OUT / "items.json") if row["name"] == "Lamp of the Djinn"]
        self.assertEqual([(row["variant"], row["setting"]) for row in lamps], [("", "khemri")])
        [lamp] = lamps
        [rule] = lamp["rules"]
        self.assertEqual([table["columns"][1] for table in rule["tables"]], ["Light", "Dark"])
        [row] = lamp["availabilities"]
        self.assertEqual((row["cost"], row["dice"], row["rarity"], row["for_everyone"]), (50, 2, 12, True))
