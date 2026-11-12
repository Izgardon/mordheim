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
from catalogue_import.sources import BACKEND, OUT

SPELL_DATA = BACKEND / "apps" / "spells" / "data"


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

    # 2. Separations, nicknames and wordings: where the rules really differ, the later takes its brackets

    def test_the_athel_loren_poison_wind_globe_is_its_own_item(self) -> None:
        # ours (Mutiny in Marienburg, the Relics of the Crusades wording) is Strength Special with a 2" splash and
        # no deviation; the Athel Loren PDF prints Strength 4, a 1" template, a D3" deviation and a globe that
        # bursts when its carrier goes down, so it is an item of its own and the Athel Loren lines name it
        ours = self.items["Poison Wind Globe"]
        self.assertEqual((ours["setting"], ours["strength"]), ("mutiny-in-marienburg", "Special"))
        theirs = self.items["Poison Wind Globe (Athel Loren)"]
        self.assertEqual((theirs["setting"], theirs["range"], theirs["strength"]), ("athel-loren", '6"', "4"))
        self.assertEqual(
            [rule.get("rule") or rule.get("name") for rule in theirs["rules"]],
            ["thrown-weapon", "no-save", "Template", "Fragile"],
        )
        self.assertEqual(self.rows("Poison Wind Globe (Athel Loren)", "skaven-of-clan-skryre-ath"), [(50, None, 6, "")])  # fmt: skip
        shown = {
            (line["item"]["name"], line["shown_as"])
            for row in self.templates["skaven-of-clan-skryre-athel-loren"]["lists"]
            for line in row["lines"]
            if "Poison Wind Globe" in line["item"]["name"]
        }
        self.assertEqual(shown, {("Poison Wind Globe (Athel Loren)", "Poison Wind Globes")})

    def test_the_druchii_sea_dragon_cloak_is_its_own_item_and_ours_stays_the_dark_elves(self) -> None:
        # ours is a flat 4+ save against missiles and 5+ in close combat; the PDF's adds +2 and +1 to a save he
        # already has and may be worn with other armour. The brackets are the Druchii's, Mordheim 2a being the
        # earliest setting of the two warbands that buy it (the Dark Elf Corsairs are Mousillon's).
        ours = self.items["Sea Dragon Cloak"]
        self.assertEqual(ours["setting"], "mordheim-1b")
        self.assertIn("5+ armour save in close combat", ours["rules"][0]["text"])
        theirs = self.items["Sea Dragon Cloak (Druchii)"]
        self.assertEqual(theirs["setting"], "mordheim-2a")
        text = theirs["rules"][0]["text"]
        for clause in ("+2 to his armour save against shooting", "5+ save against shooting if he has none", "+1 to his armour save in close combat", "6+ save in close combat if he has none", "worn together with other armour"):  # fmt: skip
            with self.subTest(clause=clause):
                self.assertIn(clause, text)
        self.assertEqual(self.rows("Sea Dragon Cloak (Druchii)", "druchii"), [(30, 2, 10, "")])
        self.assertEqual(self.rows("Sea Dragon Cloak (Druchii)", "dark-elf-corsairs"), [(50, 2, 10, "")])
        shown = {
            (slug, line["shown_as"], line["cost"])
            for slug in ("druchii", "dark-elf-corsairs")
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == "Sea Dragon Cloak (Druchii)"
        }
        self.assertEqual(shown, {("druchii", "Sea Dragon Cloak", 30), ("dark-elf-corsairs", "Dragon Cloak", 50)})

    def test_the_altdorf_quarterstaff_is_just_a_mace(self) -> None:
        # William, 12 Nov 2026: 3 gc with Concussion is our Club, Mace or Hammer, so the item goes and the Wizard
        # list buys ours under the page's name. Our Quarter Staff (15 gc, Balanced and Freestyle) is untouched.
        self.assertNotIn("Quarterstaff (Altdorf Expeditionary Party)", self.items)
        mace = self.items["Club, Mace or Hammer"]
        self.assertEqual([rule["rule"] for rule in mace["rules"]], ["concussion"])
        [row] = mace["availabilities"]
        self.assertEqual((row["cost"], row["for_everyone"]), (3, True))
        shown = {
            (line["shown_as"], line["cost"])
            for row in self.templates["altdorf-expeditionary-party"]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == "Club, Mace or Hammer"
        }
        self.assertIn(("Quarterstaff", 3), shown)
        self.assertEqual([row["cost"] for row in self.items["Quarter Staff"]["availabilities"]], [15])

    def test_the_magic_carpet_is_destroyed_by_fire(self) -> None:
        [rule] = self.items["Magic Carpet"]["rules"]
        self.assertIn("cannot be destroyed, except by fire", rule["text"])
        self.assertIn("taken out of action by fire it is destroyed outright", rule["text"])

    def test_the_house_guards_pike_and_khemris_tufenk_are_already_ours(self) -> None:
        # the two §2 items with nothing to do: the House Guard's pike is our Pike with a price row of its own, and
        # the Khemri page's Strength 1 Tufenk was never imported, so our Strength 2 one stands alone
        self.assertEqual([name for name in self.items if name.startswith("Pike")], ["Pike"])
        self.assertEqual(self.rows("Pike", "house-guard"), [(10, None, 8, "House Guard only")])
        self.assertEqual([name for name in self.items if name.startswith("Tufenk")], ["Tufenk"])
        self.assertEqual(self.items["Tufenk"]["strength"], "2")
        self.assertEqual(self.rows("Tufenk", "arabian-tomb-raiders"), [(15, None, 10, "")])

    # 3. Numbers where ours was wrong

    def test_the_nehekharan_javelins_throw_12_inches(self) -> None:
        self.assertEqual(self.items["Nehekharan Javelins"]["range"], '12"')

    def test_the_scarab_song_is_12_inches_and_one_d6(self) -> None:
        spells = {row["name"]: row["description"] for row in load_json(SPELL_DATA / "spells.json")}
        song = spells["Merneptah's Scroll of the Scarab Song"]
        self.assertEqual(song, 'Target within 12" suffers 1D6 S1 hits and cannot be shot at or fight in combat.')

    def test_the_assassin_squads_master_of_poisons_brews_d3_minus_one(self) -> None:
        text = self.skills["Master of Poisons (Assassin Squad)"]
        self.assertIn("brew D3-1 portions", text)
        self.assertNotIn("3D-1", text)
