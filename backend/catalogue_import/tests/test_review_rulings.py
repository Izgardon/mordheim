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
from catalogue_import.sources import BACKEND, ITEM_DATA, OUT

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
        # ours (Mutiny in Marienburg's item, the Relics of the Crusades wording) is Strength Special with a 2" splash and
        # no deviation; the Athel Loren PDF prints Strength 4, a 1" template, a D3" deviation and a globe that
        # bursts when its carrier goes down, so it is an item of its own and the Athel Loren lines name it
        ours = self.items["Poison Wind Globe"]
        # ours is Mutiny in Marienburg's, and a grade 2a one, so it reads in Mordheim 2a (see the setting moves)
        self.assertEqual((ours["setting"], ours["strength"]), ("mordheim-2a", "Special"))
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
        # already has and may be worn with other armour. The brackets and the item are the Druchii's alone (the
        # page's "Corsairs" is their own henchman unit; see the Corsairs' own test below).
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
        shown = {
            (slug, line["shown_as"], line["cost"])
            for slug in ("druchii",)
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == "Sea Dragon Cloak (Druchii)"
        }
        self.assertEqual(shown, {("druchii", "Sea Dragon Cloak", 30)})

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

    # 4. Mutiny in Marienburg's items sit in the setting of their own grade

    def test_each_mutiny_in_marienburg_item_sits_in_the_setting_of_its_grade(self) -> None:
        # William, 12 Nov 2026: a MiM item of a Mordheim grade belongs to that Mordheim setting; the grades above
        # the supplement's own 2b ("2c" and "3a", which the system has no part for) are 2b and stay in it
        mim = [row for row in load_json(OUT / "items.json") if row["origin"] == "mim"]
        by_setting: dict[str, list[str]] = {}
        for row in mim:
            by_setting.setdefault(row["setting"], []).append(row["name"])
        self.assertEqual(
            {setting: len(names) for setting, names in sorted(by_setting.items())},
            {"mordheim": 3, "mordheim-1b": 7, "mordheim-2a": 6, "mutiny-in-marienburg": 45},
        )
        self.assertEqual(sorted(by_setting["mordheim"]), ["Caber", "Falconry Glove", "Lyre"])
        self.assertEqual(
            sorted(by_setting["mordheim-1b"]),
            [
                "Albion Cloth",
                "Alcoholic Spirits",
                "Fish-hook Shot/Hunting Lasso",
                "Gas Mask",
                "Iron Strongbox",
                "Thief's Cloak",
                "Wolf Cloak/Norse Furs",
            ],  # fmt: skip
        )
        self.assertEqual(
            sorted(by_setting["mordheim-2a"]),
            [
                "Beast Hide/Wyvern Hide Cloak",
                "Hunter's Throwing Axe",
                "Poison Wind Globe",
                "Shark-tooth Necklace",
                "Skull Cap",
                "Stiletto Blade",
            ],  # fmt: skip
        )

    def test_no_item_is_graded_2c_or_3a_any_more(self) -> None:
        grades = {str(row.get("grade")) for row in load_json(ITEM_DATA / "mim-items.json")}
        self.assertEqual(grades, {"1a", "1b", "2a", "2b"})

    def test_mutiny_in_marienburg_is_a_one_grade_setting_now(self) -> None:
        settings = {row["slug"]: row for row in load_json(OUT / "settings.json")}
        mim = settings["mutiny-in-marienburg"]
        self.assertEqual((mim["grade"], mim["grades_seen"]), ("2b", {"2b": 58}))
        self.assertEqual(mim["counts"]["items"], 45)

    # 5. Price rows: the types join the row that already carries their price

    def test_the_nehekhara_tomb_guards_may_buy_their_own_lists_three_khemri_items(self) -> None:
        # their own template's lists sell all three, while our rows named the Tomb Guardians alone, so in the store
        # they read "Not usually available"; the prices are identical, so the type joins the row
        for name, cost in (("Asp Arrows", 10), ("Nehekharan Javelins", 10), ("Serpent Staff", 30)):
            with self.subTest(item=name):
                [(row_cost, _dice, _rarity, _note)] = self.rows(name, "nehekhara-tomb-guards")
                self.assertEqual(row_cost, cost)
                buyers = {
                    entry["type"]
                    for row in self.items[name]["availabilities"]
                    for entry in row["warbands"]
                    if "type" in entry and not entry["excluded"]
                }
                self.assertEqual(buyers, {"tomb-guardians", "nehekhara-tomb-guards"})
                lines = {
                    line["item"]["name"]
                    for row in self.templates["nehekhara-tomb-guards"]["lists"]
                    for line in row["lines"]
                }
                self.assertIn(name, lines)

    def test_the_sea_ghosts_and_the_corsairs_join_our_sea_dragon_cloaks_row(self) -> None:
        [row] = self.items["Sea Dragon Cloak"]["availabilities"]
        buyers = [entry["type"] for entry in row["warbands"]]
        self.assertEqual(buyers, ["dark-elves", "dark-elf-corsairs", "sea-ghosts"])
        self.assertEqual((row["cost"], row["dice"], row["rarity"]), (50, 2, 10))

    def test_the_glyph_of_blasting_and_the_grimoire_keep_the_expeditionary_partys_rows(self) -> None:
        # the one item in the price-row pile with nothing to do: both already name that warband and nothing else
        for name in ("Glyph of Blasting", "Grimoire of Magic"):
            with self.subTest(item=name):
                [row] = self.items[name]["availabilities"]
                self.assertFalse(row["for_everyone"])
                self.assertEqual(row["warbands"], [{"type": "altdorf-expeditionary-party", "excluded": False}])

    # 6. Spelling, aligned (William: "fix all spelling and keep it aligned")

    def test_the_arabyan_thieves_are_spelt_the_same_everywhere(self) -> None:
        # the warband type already read "Arabyan Thieves" (overrides.json warband_type_names) while its template,
        # its skill group and two of its skills kept Broheim's "Theives"; the type's slug stays the source's
        types = {row["slug"]: row["name"] for row in load_json(OUT / "warband-types.json")}
        self.assertEqual(types["arabyan-theives"], "Arabyan Thieves")
        template = next(row for row in self.templates.values() if "arabyan-th" in row["slug"])
        self.assertEqual(template["name"], "Arabyan Thieves")
        self.assertEqual([row["type"] for row in template["types"]], ["arabyan-theives"])
        self.assertIn("Arabyan Thieves", self.groups)
        self.assertLessEqual(
            {"Knife Fighting (Arabyan Thieves)", "Hide in Shadows (Arabyan Thieves)"},
            set(self.groups["Arabyan Thieves"]),
        )
        misspelt = [name for name in (*self.skills, *self.groups, *(row["name"] for row in self.templates.values())) if "Theives" in name]  # fmt: skip
        self.assertEqual(misspelt, [])

    def test_the_khemri_mage_warbands_group_is_named_after_its_warband(self) -> None:
        # every other group is named after its warband; "Magician Skills" was the PDF's name for the column
        self.assertNotIn("Magician Skills", self.groups)
        self.assertEqual(self.groups["Mages"], ["Dispel", "Store Spell", "Clockwork Mage"])

    def test_dispel_and_virtue_of_valour_are_spelt_as_the_catalogue_spells_them(self) -> None:
        # the Altdorf skill was "Dispell", which its page prints and nothing else in the catalogue does; our own
        # Bretonnian Knights row read "Virtue of Valor" where mordheimer, the Bitter Moors' skill and its own
        # description all say "Valour"
        self.assertEqual(sorted(name for name in self.skills if name.startswith("Dispel")), ["Dispel", "Dispel (Altdorf Expeditionary Party)"])  # fmt: skip
        self.assertEqual(sorted(name for name in self.skills if "Valo" in name), ["Virtue of Valour", "Virtue of Valour (Knights of the Bitter Moors)"])  # fmt: skip
        self.assertIn("valourous", self.skills["Virtue of Valour"])

    def test_the_low_kings_hide_in_shadows_rule_is_cased_as_every_other_spelling_of_it(self) -> None:
        rules = [row["title"] for row in self.templates["low-kings"]["rules"]]
        specials = [
            special["name"] for fighter in self.templates["low-kings"]["fighters"] for special in fighter["specials"]
        ]
        self.assertNotIn("Hide In Shadows", [*rules, *specials])
        self.assertIn("Hide in Shadows", specials)

    def test_the_dark_elf_corsairs_buy_our_standard_cloak_not_the_druchiis(self) -> None:
        # William, 12 Nov 2026: "corsairs should point at the other sea dragon cloak i think which is 50+2d6 in
        # store, and starting price of just 50 on their list". The +2/+1 stacking cloak the Druchii page prints is
        # that warband's: its "Corsairs may wear Sea Dragon Cloaks though they are not Heroes" names the Druchii's
        # own henchman unit, not the Mousillon warband of the same name, whose own page prints no rules for it.
        # So the Corsairs take our flat 4+ against missiles and 5+ in close combat, not the stacking saves.
        self.assertEqual(self.rows("Sea Dragon Cloak (Druchii)", "dark-elf-corsairs"), [])
        [row] = self.items["Sea Dragon Cloak (Druchii)"]["availabilities"]
        self.assertEqual(row["warbands"], [{"type": "druchii", "excluded": False}])
        self.assertEqual(self.rows("Sea Dragon Cloak", "dark-elf-corsairs"), [(50, 2, 10, "")])
        shown = {
            (line["item"]["name"], line["shown_as"], line["cost"])
            for row in self.templates["dark-elf-corsairs"]["lists"]
            for line in row["lines"]
            if "Sea Dragon Cloak" in line["item"]["name"]
        }
        self.assertEqual(shown, {("Sea Dragon Cloak", "Dragon Cloak", 50)})
        self.assertIn("5+ armour save in close combat", self.items["Sea Dragon Cloak"]["rules"][0]["text"])
