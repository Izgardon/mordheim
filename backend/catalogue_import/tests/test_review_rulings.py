"""William's review of 12 Nov 2026: the skills and items merged into one row, the ones separated because their
rules really differ, and the numbers of ours that were wrong (groups 1 to 3 of the review), with its later
rulings on the Sea Dragon Cloak, on the Druchii's two equipment lists and on the Mortuary Cult scrolls, whose
two printings became two lores (13 Nov 2026). The settings, the price rows, the spelling and the two warband
types are in test_review_rulings_data.py.
"""

import json
from typing import Any, ClassVar

from catalogue_import.common import load_json
from catalogue_import.sources import OUT
from catalogue_import.tests.review_support import SPELL_DATA, ReviewCase


class MergesAndSeparationsTests(ReviewCase):
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
        # and the Sealed City's own price chart adds the setting's trading row beside its list's starting
        # price (Lost and Found, 12 Nov 2026)
        self.assertEqual(self.rows("Pike", "house-guard"), [(12, None, 9, ""), (10, None, 8, "House Guard only")])
        self.assertEqual([name for name in self.items if name.startswith("Tufenk")], ["Tufenk"])
        self.assertEqual(self.items["Tufenk"]["strength"], "2")
        self.assertEqual(self.rows("Tufenk", "arabian-tomb-raiders"), [(15, None, 10, "")])

    # 3. Numbers where ours was wrong

    def test_the_nehekharan_javelins_throw_12_inches(self) -> None:
        self.assertEqual(self.items["Nehekharan Javelins"]["range"], '12"')

    def test_the_assassin_squads_master_of_poisons_brews_d3_minus_one(self) -> None:
        text = self.skills["Master of Poisons (Assassin Squad)"]
        self.assertIn("brew D3-1 portions", text)
        self.assertNotIn("3D-1", text)

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

    def test_no_template_list_holds_one_item_on_two_lines_that_say_the_same_thing(self) -> None:
        # William, 12 Nov 2026, of the Druchii Sea Dragon Cloak: "collapse it". No list anywhere holds a line twice
        # over: a repeated item on one list is always told apart by what it is shown as, or by its price (the books
        # printing "Mace" and "Hammer" for our one Club, Mace or Hammer; the Pit Fighters (old) Spiked Gauntlet at
        # 15 and 20 gc). This guards that, so a real duplicate cannot creep in unnoticed.
        same = [
            (row["slug"], equipment["key"], line)
            for row in self.templates.values()
            for equipment in row["lists"]
            for line in [json.dumps(entry, sort_keys=True) for entry in equipment["lines"]]
            if [json.dumps(entry, sort_keys=True) for entry in equipment["lines"]].count(line) > 1
        ]
        self.assertEqual(same, [])

    def test_the_druchii_cloak_is_one_line_on_each_of_two_lists_not_one_list_twice(self) -> None:
        # the two lines are the page's own, one on the Druchii Heroes list and one on the Corsairs list, which is
        # why the warband carries the rule "Corsairs may wear Sea Dragon Cloaks though they are not Heroes": the
        # Corsair is a henchman. Each list shows it once, no screen shows the two together, and collapsing them
        # would take the cloak off either the Nobles or the Corsairs.
        where = {
            equipment["key"]: [
                line["cost"] for line in equipment["lines"] if "Sea Dragon Cloak" in line["item"]["name"]
            ]  # fmt: skip
            for equipment in self.templates["druchii"]["lists"]
        }
        self.assertEqual(
            {key: costs for key, costs in where.items() if costs},
            {"druchii-heroes-equipment-list": [30], "corsairs-equipment-list": [30]},
        )
        buyers = {
            fighter["name"]: fighter["lists"]
            for fighter in self.templates["druchii"]["fighters"]
            if fighter["name"] in ("Noble", "Corsair")
        }
        self.assertEqual(buyers, {"Noble": ["druchii-heroes-equipment-list"], "Corsair": ["corsairs-equipment-list"]})


class MortuaryCultScrollsTests(ReviewCase):
    """William, 13 Nov 2026 ("Yes 2 lores seems best"): the Mortuary Cult scrolls are printed twice, and the two
    printings differ on more than wording - Merneptah's tail is opposite in effect, Neferre's difficulty is 7 in one
    and 8 in the other - so each warband's Liche Priest reads his own book's lore. The Tomb Guardians' printing is
    the earliest, so it keeps the true name; the Nehekhara Tomb Guards' is named for the warband.
    """

    OLD = "Mortuary Cult Scrolls"
    NEW = "Mortuary Cult Scrolls (Nehekhara Tomb Guards)"
    spells: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.spells = {}
        for row in load_json(SPELL_DATA / "spells.json"):
            cls.spells.setdefault(row["type"], {})[row["name"]] = row

    def test_both_printings_are_lores_of_their_own_with_the_same_six_scrolls(self) -> None:
        self.assertIn(self.NEW, self.spells)
        self.assertEqual(sorted(self.spells[self.OLD]), sorted(self.spells[self.NEW]))
        self.assertEqual(len(self.spells[self.NEW]), 6)
        # the Nehekhara printing is Khemri 3's, as that warband is
        self.assertEqual({row.get("setting") for row in self.spells[self.NEW].values()}, {"khemri-3"})

    def test_the_difficulties_are_each_printings_own(self) -> None:
        old = {name: row["dc"] for name, row in self.spells[self.OLD].items()}
        new = {name: row["dc"] for name, row in self.spells[self.NEW].items()}
        self.assertEqual(old["Neferre's Scroll of Quaking Horror"], "7")
        self.assertEqual(new["Neferre's Scroll of Quaking Horror"], "8")
        self.assertEqual(old["Merneptah's Scroll of the Scarab Song"], "7")
        self.assertEqual(new["Merneptah's Scroll of the Scarab Song"], "6")

    def test_the_scarab_song_is_each_printings_own_range_dice_and_tail(self) -> None:
        # ours carried printing B's 12"/1D6 on printing A's difficulty, with the tail cut off: a hybrid faithful to
        # neither. The tails are opposite, which is what makes these two rules and not one transcribed twice.
        old = self.spells[self.OLD]["Merneptah's Scroll of the Scarab Song"]["description"]
        new = self.spells[self.NEW]["Merneptah's Scroll of the Scarab Song"]["description"]
        self.assertIn('within 8"', old)
        self.assertIn("2D6 Strength 1 hits", old)
        self.assertIn("counts as having just stood up in the next turn", old)
        self.assertIn('within 12"', new)
        self.assertIn("1D6 Strength 1 hits", new)
        self.assertIn("may be attacked and attack as normal in his next turn", new)

    def test_djedres_summonation_keeps_each_printings_own_limits(self) -> None:
        old = self.spells[self.OLD]["Djedre's Summonation of the Vengeful Dead"]["description"]
        new = self.spells[self.NEW]["Djedre's Summonation of the Vengeful Dead"]["description"]
        self.assertIn("during the last turn", old)
        self.assertIn("not straight into hand-to-hand combat", old)
        self.assertNotIn("during the last turn", new)
        self.assertNotIn("not straight into hand-to-hand combat", new)

    def test_each_liche_priest_casts_from_his_own_warbands_printing(self) -> None:
        def lores(slug: str) -> list[str]:
            found = next(row for row in self.templates[slug]["fighters"] if row["name"] == "Liche Priest")
            return [lore["name"] for lore in found["spell_types"]]

        self.assertEqual(lores("tomb-guardians"), [self.OLD])
        self.assertEqual(lores("nehekhara-tomb-guards"), [self.NEW])
