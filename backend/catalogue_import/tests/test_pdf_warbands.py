"""The warbands read from their PDFs (pdf_warbands.py, pdf_check.py): every source file in `sources/pdf-warbands/`
passes the check, the check finds what a bad file gets wrong, and the import builds each file's template, stubs and
skill group by the snapshot's code path."""

from dataclasses import replace
from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.common import load_json, slugify
from catalogue_import.pdf_check import Catalogue, check_page, load_catalogue
from catalogue_import.pdf_warbands import (
    ORIGIN,
    PDF_SOURCES,
    TYPE,
    add_price_rows,
    page_item_rules,
    put_aliases_right,
    skill_settings,
    stub_items,
    tables_as_html,
)
from catalogue_import.sources import HIRELING_DATA, OUT
from catalogue_import.template_lists import ItemIndex
from catalogue_import.template_text import clean_rule
from catalogue_import.template_upgrades import halved
from catalogue_import.templates import our_races_and_lores

FILES = {path.stem: load_json(path) for path in sorted(PDF_SOURCES.glob("*.json"))}
PROFILE = {"m": 4, "ws": 4, "bs": 4, "s": 3, "t": 3, "w": 1, "i": 4, "a": 1, "ld": 8}
TICKS = {"combat": True, "shooting": False, "academic": False, "strength": True, "speed": True, "special": True}
ITEMS = [
    {"name": "Dagger", "variant": "", "slug": "dagger", "tags": ["dagger"]},
    {"name": "Sword", "variant": "", "slug": "sword", "tags": ["sword"]},
]
TYPES = [{"slug": "witch-hunters", "setting": "mordheim-1a"}]


def good_page() -> dict[str, Any]:
    return {
        "warbandType": "witch-hunters",
        "name": "Test Band",
        "source": "Town Cryer",
        "sourceLink": "https://example.test/band.pdf",
        "warbandRules": {"startingGc": 500, "maxModels": 12},
        "specialRules": [{"rulename": "Zeal", "ruleFull": "Heroes re-roll a failed rout test."}],
        "equipmentLists": [
            {
                "id": "heroes",
                "title": "Heroes",
                "caveat": "",
                "items": [
                    {"name": "dagger", "alias": "", "cost": {"costPrefix": "1st free/", "cost": 2}},
                    {"name": "swrod", "alias": "", "cost": {"cost": 10, "costSuffix": "Captain only"}},
                    {"name": "pry bar", "alias": "", "cost": {"cost": 10}},
                ],
            }
        ],
        "fighters": [
            {
                "id": "captain",
                "type": "hero",
                "name": "Captain",
                "plural": "Captains",
                "race": "human",
                "minQty": 1,
                "maxQty": 1,
                "costGc": 60,
                "startingXp": 20,
                "statblock": dict(PROFILE),
                "equipmentLists": ["heroes"],
                "skillAccess": dict(TICKS),
                "specialRules": [],
            }
        ],
        "skillGroup": {"name": "Zealots", "new": True},
        "specialSkillsList": [
            {"name": "Fervour", "description": "The Hero may re-roll one failed Leadership test a battle."},
            {"name": "Brave", "ours": "Brave"},
        ],
        "aliases": [{"pdf": "swrod", "ours": "sword", "page": 1}],
        "stubs": [{"name": "Pry Bar", "type": "Weapon", "subtype": "Melee", "rarity": 8, "dice": 1, "rulesPage": 2}],
        "flags": [{"page": 1, "what": "A doubt."}],
    }


CATALOGUE = Catalogue(
    ItemIndex(ITEMS), {"Combat": {"Brave"}}, {"brave"}, {"Human"}, {"Lesser Magic"}, {"witch-hunters"}, {"parry"}
)


class PdfFilesTests(SimpleTestCase):
    def test_every_source_file_passes_the_check(self) -> None:
        catalogue = load_catalogue(FILES, *our_races_and_lores())
        for slug, page in FILES.items():
            with self.subTest(file=slug):
                self.assertEqual(check_page(slug, page, catalogue).problems, [])


class PdfCheckTests(SimpleTestCase):
    def test_a_good_page_passes_its_alias_and_stub_matched(self) -> None:
        found = check_page("witch-hunters", good_page(), CATALOGUE)
        self.assertEqual((found.problems, found.lines, found.stubs), ([], 3, ["Pry Bar"]))

    def test_shape_stats_counts_and_gold(self) -> None:
        page = good_page()
        del page["warbandRules"]["maxModels"]
        page["warbandRules"]["startingGold"] = 500
        fighter = page["fighters"][0]
        fighter["statblock"]["ws"], fighter["statblock"]["s"] = 11, "3(4)"
        fighter["minQty"], fighter["maxQty"], fighter["groupSize"] = 2, 1, {"min": 1, "max": 5}
        problems = check_page("witch-hunters", page, CATALOGUE).problems
        self.assertEqual(
            problems,
            ["warband rules: unknown key 'startingGold'", "warband rules: no 'maxModels'"],
        )
        page["warbandRules"] = {"startingGc": 500, "maxModels": 12}
        problems = check_page("witch-hunters", page, CATALOGUE).problems
        self.assertEqual(
            problems,
            [
                "fighter Captain: ws 11 is no stat",
                "fighter Captain: 2-1 is no count",
                "fighter Captain: a hero has starting XP and skill access, and no group size",
            ],
        )

    def test_names_must_be_ours_or_stubs_and_notes_read(self) -> None:
        page = good_page()
        page["equipmentLists"][0]["items"][0]["cost"]["costSuffix"] = "Captain or Witch only"
        page["equipmentLists"][0]["items"].append({"name": "war chain", "alias": "", "cost": {"cost": 20}})
        page["stubs"].append(
            {"name": "Dagger", "type": "Weapon", "subtype": "", "rarity": None, "dice": None, "rulesPage": 2}
        )
        page["fighters"][0].update(race="elfish", spellLores=["Necromancy"])
        page["specialSkillsList"] += [{"name": "Brave", "description": "Ours."}, {"name": "Grim", "ours": "Grim"}]
        problems = check_page("witch-hunters", page, CATALOGUE).problems
        self.assertEqual(
            problems,
            [
                "fighter Captain: no lore 'Necromancy'",
                "fighter Captain: no race of ours for 'elfish'",
                "Heroes, dagger: the note 'Captain or Witch only' isn't read",
                "stub 'Dagger': our 'Dagger' (its name), link it",
                "Heroes, war chain: no item of ours and no stub",
                "stub 'Dagger': no line names it",
                "special skill 'Brave': one of our skills holds the name, use it or name it apart",
                "special skill 'Grim': no skill of ours 'Grim'",
            ],
        )

    def test_a_fighters_starting_skills_must_be_ours(self) -> None:
        page = good_page()
        page["fighters"][0]["skills"] = ["Brave", "Fervour", "Grim"]  # ours, the page's own, and neither
        catalogue = replace(CATALOGUE, page_skills={"fervour"})
        self.assertEqual(
            check_page("witch-hunters", page, catalogue).problems,
            ["fighter Captain: no skill of ours 'Grim' to start with"],
        )

    def test_an_existing_group_holds_the_skills_named_and_every_list_is_bought_from(self) -> None:
        page = good_page()
        page["skillGroup"] = {"name": "Combat", "new": False}
        page["specialSkillsList"] = [{"name": "Brave", "ours": "Brave"}]
        page["equipmentLists"].append({"id": "spare", "title": "Spare", "caveat": "", "items": []})
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems, ["list 'spare': no fighter buys from it"]
        )
        page["skillGroup"] = {"name": "Zealots", "new": False}
        self.assertIn(
            "skill group 'Zealots': no such group of ours", check_page("witch-hunters", page, CATALOGUE).problems
        )

    def test_a_new_group_may_note_who_takes_its_shared_skills(self) -> None:
        # William, 6 Nov 2026: a shared skill's "who may take it" is the group's note, as "Vampire only" is
        page = good_page()
        page["skillGroup"]["note"] = "Brave: the Captain only."
        self.assertEqual(check_page("witch-hunters", page, CATALOGUE).problems, [])
        page["skillGroup"]["note"] = "x" * 201
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            ["skill group 'Zealots': its note is over 200 characters"],
        )
        page["skillGroup"] = {"name": "Combat", "new": False, "note": "Brave: the Captain only."}
        page["specialSkillsList"] = [{"name": "Brave", "ours": "Brave"}]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            ["skill group 'Combat': only a new group takes a note"],
        )

    def test_a_warband_with_no_special_column_has_no_skill_group(self) -> None:
        # the Outlaws of Stirwood Forest, Redux (PDF p2): no Special column, no special skills
        page = good_page()
        del page["skillGroup"], page["specialSkillsList"]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            ["fighter Captain: ticks Special, but the page has no skill group"],
        )
        page["fighters"][0]["skillAccess"]["special"] = False
        self.assertEqual(check_page("witch-hunters", page, CATALOGUE).problems, [])
        page["specialSkillsList"] = []
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            ["witch-hunters: a skill group and its special skills, or neither (no Special column)"],
        )

    def test_a_stubs_rules_are_shared_ones_or_its_own_and_a_price_row_is_on_one_of_ours(self) -> None:
        # the Metal Mongers' Ratling Gun (PDF p6) and the Low Kings' Spiked Gauntlet (p5; William, 6 Nov 2026)
        page = good_page()
        page["stubs"][0]["rules"] = [{"rule": "Parry"}, {"name": "Jab", "text": "+1 Attack."}, {"rule": "Feint"}]
        page["priceRows"] = [
            {"name": "sword", "rarity": 7, "dice": None, "note": "", "page": 5},
            {"name": "pry bar", "rarity": 7, "dice": None, "page": 5},
        ]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            [
                "stub 'Pry Bar': 'Feint' is no shared item rule of ours",
                "price row 'pry bar': no item of ours and no stub any page declares",
            ],
        )

    def test_a_rule_a_line_and_a_fighter_name_one_of_the_pages_variants(self) -> None:
        # the House Guard's three houses: a page declares its variants, and whatever names one must name its key
        page = good_page()
        page["variants"] = [{"key": "Fierezza", "name": "House Fierezza"}, {"key": "halcon", "name": "House Halcon"}]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            ["variant 'Fierezza': its key should be 'fierezza'"],
        )
        page["variants"][0]["key"] = "fierezza"
        page["specialRules"][0]["variant"] = "baluardo"
        page["equipmentLists"][0]["items"][0]["variant"] = "halcon"
        page["fighters"][0]["variantChanges"] = {
            "halcon": {"skillAccess": {"combat": True}, "skills": ["Web of Steel"], "stats": {"zz": 4}},
        }
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            [
                "warband rule Zeal: no variant 'baluardo'",
                "fighter Captain (halcon): skill access should tick combat, shooting, academic, strength, speed,"
                " special true or false",
                "fighter Captain (halcon): no skill of ours 'Web of Steel'",
                "fighter Captain (halcon): 'zz' is no characteristic",
            ],
        )

    def test_a_price_row_may_name_a_stub_another_page_declares(self) -> None:
        # Sartosa's shop row on Throwing Axes, the Dwarf Slayer Cult's stub: price rows are added after the stubs
        page = good_page()
        page["stubs"] = []
        page["equipmentLists"][0]["items"] = page["equipmentLists"][0]["items"][:2]
        page["priceRows"] = [{"name": "pry bar", "cost": 15, "rarity": 5, "dice": None, "page": 10}]
        catalogue = replace(CATALOGUE, page_stubs={"prybar"})
        self.assertEqual(check_page("witch-hunters", page, catalogue).problems, [])

    def test_a_dice_multiplier_needs_dice(self) -> None:
        # "100 + D6x10" (Bramstetter's Advanced Construct Thesis, Clockworkers p6): dice 1, diceMultiplier 10
        page = good_page()
        page["stubs"][0]["dice"], page["stubs"][0]["diceMultiplier"] = None, 10
        page["priceRows"] = [{"name": "sword", "rarity": 7, "dice": None, "diceMultiplier": 25, "page": 5}]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            [
                "stub 'Pry Bar': a dice multiplier needs dice",
                "price row 'sword': a dice multiplier needs dice",
            ],
        )

    def test_a_price_row_may_name_the_types_it_serves(self) -> None:
        # a setting's shop list is declared once (Sartosa's, for its twelve types), and names types of ours
        page = good_page()
        page["priceRows"] = [
            {"name": "dagger", "rarity": None, "dice": None, "types": ["witch-hunters"], "page": 10},
            {"name": "sword", "rarity": 5, "dice": None, "types": ["no-such-band"], "page": 10},
        ]
        self.assertEqual(
            check_page("witch-hunters", page, CATALOGUE).problems,
            [
                "price row 'sword': no warband type 'no-such-band'",
                "price row 'sword': the page's own type isn't one of its types",
            ],
        )


class PdfImportTests(SimpleTestCase):
    templates: ClassVar[dict[str, dict[str, Any]]]
    items: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.templates = {row["slug"]: row for row in load_json(OUT / "warband-templates.json")}
        cls.items = {row["name"]: row for row in load_json(OUT / "items.json")}

    def test_the_shared_skills_sit_in_the_earliest_setting_that_declares_them(self) -> None:
        settings = {row["name"]: row["setting"] for row in load_json(OUT / "setting-assignments.json")["skills"]}
        self.assertEqual(settings["Elven Luck"], "mordheim-2a")  # Athel Loren's (2a) and Arden's (Mousillon)
        self.assertEqual(settings["Excellent Sight"], "mordheim-2a")  # the Druchii's, the Corsairs', both Wood Elves'
        self.assertEqual(settings["Songster"], "mordheim-2a")  # the Slayer Cult's (2a) and the Channel Rats' (MiM)
        self.assertEqual(settings["Deathwish"], "mordheim-2a")  # the Slayer Cult's and the Slayer Pirates' (Sartosa)
        self.assertEqual(settings["Iron Will"], "mordheim-2a")  # the Protectorate's and the Vampire Hunters' (2a)
        self.assertEqual(settings["Cloud of Flies"], "lustria")  # the Lustria (1b) and Mousillon (2b) Pestilens

    def test_a_skill_two_pages_share_keeps_the_earlier_setting(self) -> None:
        # a shared new skill can sit in only one setting, and which one must not depend on the order the source
        # files are read in: the Wood Elves of Arden (Mousillon) and of Athel Loren (Mordheim 2a) both declare
        # Elven Luck, and it belongs to the earlier of the two settings
        late, early = good_page(), good_page()
        late[TYPE], early[TYPE] = "late-band", "early-band"
        late["skillGroup"], early["skillGroup"] = {"name": "Late", "new": True}, {"name": "Early", "new": True}
        shared = {"name": "Elven Luck", "description": "Once a game the Elf may re-roll a failed roll."}
        late["specialSkillsList"] = [dict(shared)]
        early["specialSkillsList"] = [dict(shared), {"name": "Own", "description": "His own."}]
        setting_of = {"late-band": "mousillon", "early-band": "mordheim-2a"}
        # the pages are read in name order, so the later setting's page comes first
        pages = {"a-late": late, "b-early": early}
        self.assertEqual(skill_settings(pages, setting_of), {"Elven Luck": "mordheim-2a", "Own": "mordheim-2a"})
        self.assertEqual(skill_settings({"b-early": early, "a-late": late}, setting_of)["Elven Luck"], "mordheim-2a")

    def test_aliases_are_put_right_as_a_page_loads(self) -> None:
        page = good_page()
        put_aliases_right(page)
        self.assertEqual([line["name"] for line in page["equipmentLists"][0]["items"]], ["dagger", "sword", "pry bar"])

    def test_a_stub_is_a_bare_item_for_its_type_at_its_line_price(self) -> None:
        [stub] = stub_items({"witch-hunters": good_page()}, ITEMS, TYPES)
        [row] = stub["availabilities"]
        self.assertEqual(
            (stub["name"], stub["origin"], stub["rules"], stub["setting"], stub["link_url"]),
            ("Pry Bar", ORIGIN, [], "mordheim-1a", "https://example.test/band.pdf"),
        )
        self.assertEqual(
            (row["cost"], row["dice"], row["rarity"], row["for_everyone"], row["warbands"]),
            (10, 1, 8, False, [{"type": "witch-hunters", "excluded": False}]),
        )
        page = good_page()
        page["stubs"][0]["name"] = "Sword"
        with self.assertRaisesRegex(ValueError, "the stub 'Sword' is our 'Sword'"):
            stub_items({"witch-hunters": page}, ITEMS, TYPES)

    def test_a_stub_priced_by_its_base_item_has_no_cost_of_its_own(self) -> None:
        # the Druchii's Darksteel blade (PDF p3): "3 x price", as our Gromril Weapon
        page = good_page()
        page["equipmentLists"][0]["items"][2]["cost"] = {"cost": 0, "costPrefix": "3 x price"}
        [stub] = stub_items({"witch-hunters": page}, ITEMS, TYPES)
        [row] = stub["availabilities"]
        self.assertEqual((row["cost"], row["cost_note"], row["rarity"]), (None, "3 × price", 8))

    def test_a_rules_table_keeps_its_rows_as_lines(self) -> None:
        # the Dreamwalkers' Guiding Dream (PDF p21), a pre-battle roll whose words hold the table as written
        text = "Roll a D6:\n\nD6 | Vision\n1 | -1\" Movement.\n2-6 | The opponent's Hero."
        self.assertEqual(clean_rule(tables_as_html(text)), text)
        self.assertEqual(tables_as_html("One line | of prose."), "One line | of prose.")

    def test_a_stub_two_pages_declare_is_one_item_with_a_price_for_each(self) -> None:
        # the Protectorate of Sigmar's Holy Water (5 gc) and Blessed Bolts, which the Vampire Hunters buy too
        other = good_page()
        other["warbandType"] = "sisters-of-sigmar"
        other["equipmentLists"][0]["items"][2]["cost"] = {"cost": 15}
        types = [*TYPES, {"slug": "sisters-of-sigmar", "setting": "mordheim-1a"}]
        [stub] = stub_items({"witch-hunters": good_page(), "sisters-of-sigmar": other}, ITEMS, types)
        self.assertEqual(
            [(row["cost"], row["warbands"]) for row in stub["availabilities"]],
            [
                (10, [{"type": "witch-hunters", "excluded": False}]),
                (15, [{"type": "sisters-of-sigmar", "excluded": False}]),
            ],
        )

    def test_a_stub_carries_the_rules_william_gives_linking_the_shared_ones(self) -> None:
        # the Ratling Gun (Metal Mongers p6): "its quite a lot so feel free to break down into rules"
        page = good_page()
        page["stubs"][0].update(range='6"-16"', strength="3", rules=[{"rule": "Parry"}])
        rules = {"parry": {"slug": "parry"}}
        [stub] = stub_items({"witch-hunters": page}, ITEMS, TYPES, rules)
        self.assertEqual((stub["range"], stub["rules"], stub["needs_rules"]), ('6"-16"', [{"rule": "parry"}], True))
        page["stubs"][0]["rules"].append({"name": "Metal Storm", "text": "2D6 shots."})
        page["stubs"][0]["rules"].append({"rule": "Parry", "text": "Parries a ranged attack too."})
        [stub] = stub_items({"witch-hunters": page}, ITEMS, TYPES, rules)
        self.assertEqual(stub["rules"][1], {"name": "Metal Storm", "summary": "", "text": "2D6 shots.", "tables": []})
        self.assertEqual(stub["rules"][2], {"rule": "parry", "text": "Parries a ranged attack too."})  # its own words
        self.assertFalse(stub["needs_rules"])

    def test_a_stub_carries_its_profile_and_one_two_grades_share_is_the_lower_grades(self) -> None:
        # the Night Haint's Mortis Engine rows; the 2b Night Haint's Scythe is the 2a Vampire Hunters' item
        later = good_page()
        later["warbandType"] = "sisters-of-sigmar"
        later["stubs"][0]["statblock"] = [{"profile": "Pry Bar", "m": "-", "t": 6}]
        types = [
            {"slug": "witch-hunters", "setting": "mutiny-in-marienburg", "broheim_grade": "2b"},
            {"slug": "sisters-of-sigmar", "setting": "sylvania", "broheim_grade": "2a"},
        ]
        [stub] = stub_items({"witch-hunters": good_page(), "sisters-of-sigmar": later}, ITEMS, types)
        self.assertEqual(
            (stub["setting"], stub["statblock"]), ("sylvania", [{"profile": "Pry Bar", "m": "-", "t": "6"}])
        )
        self.assertEqual(
            [row["warbands"][0]["type"] for row in stub["availabilities"]], ["sisters-of-sigmar", "witch-hunters"]
        )

    def test_a_page_brings_a_shared_item_rule_and_a_price_row_on_one_of_ours(self) -> None:
        # Experimental Technology (Metal Mongers p7: "a shared item rule that a few items will have") and the Low
        # Kings' row on our Spiked Gauntlet ("would prefer them being just one item"), at the line's price
        page = good_page()
        page["itemRules"] = [{"name": "Experimental Technology", "text": "A 1 to hit malfunctions.", "page": 7}]
        page["priceRows"] = [{"name": "sword", "rarity": 7, "dice": None, "note": "Captain only", "page": 5}]
        put_aliases_right(page)
        [rule] = page_item_rules({"witch-hunters": page})
        self.assertEqual(
            (rule["slug"], rule["text"], rule["tables"]), ("experimental-technology", page["itemRules"][0]["text"], [])
        )
        items: list[dict[str, Any]] = [{**item, "availabilities": []} for item in ITEMS]
        add_price_rows({"witch-hunters": page}, items, TYPES)
        [row] = items[1]["availabilities"]
        self.assertEqual(
            (row["cost"], row["rarity"], row["warbands"], row["note"]),
            (10, 7, [{"type": "witch-hunters", "excluded": False}], "Captain only"),
        )

    def test_a_stub_and_a_price_row_carry_a_dice_multiplier(self) -> None:
        # "100 + D6x10" and "200 + D6x25": the dice a price adds are multiplied
        page = good_page()
        page["stubs"][0]["diceMultiplier"] = 25
        page["priceRows"] = [{"name": "sword", "rarity": 7, "dice": 1, "diceMultiplier": 10, "page": 5}]
        put_aliases_right(page)
        [stub] = stub_items({"witch-hunters": page}, ITEMS, TYPES)
        self.assertEqual(stub["availabilities"][0]["dice_multiplier"], 25)
        items: list[dict[str, Any]] = [{**item, "availabilities": []} for item in ITEMS]
        add_price_rows({"witch-hunters": page}, items, TYPES)
        self.assertEqual(items[1]["availabilities"][0]["dice_multiplier"], 10)

    def test_the_clockworkers_thesis_costs_100_plus_d6_times_10(self) -> None:
        # the Clockworkers PDF, p6: 100 + D6x10 gold crowns, Rare 8
        [row] = self.items["Bramstetter's Advanced Construct Thesis"]["availabilities"]
        self.assertEqual((row["cost"], row["dice"], row["dice_multiplier"], row["rarity"]), (100, 1, 10, 8))
        self.assertEqual(self.items["Bramstetter's Advanced Construct Thesis"]["notes"], "")

    def test_the_house_guard_is_three_houses_as_three_variants(self) -> None:
        # the House Guard PDF (p2-p5): each house has its own rule, its own list lines and its own skill table
        house = self.templates["house-guard"]
        self.assertEqual([row["key"] for row in house["variants"]], ["fierezza", "halcon", "baluardo"])
        self.assertEqual(
            [(rule["title"], rule["variant"]) for rule in house["rules"]],
            [
                ("Chain of Command", ""),
                ("Personal Guard", ""),
                ("Dueling Pride", "fierezza"),
                ("Sharp Aim", "halcon"),
                ("Armour", "baluardo"),
            ],
        )
        [heroes] = [row for row in house["lists"] if row["key"] == "house-guard-heroes-equipment-list"]
        own = {line["item"]["name"]: line["variant"] for line in heroes["lines"] if line["variant"]}
        self.assertEqual(
            own,
            {
                "Rapier": "fierezza",
                "Sword Breaker": "fierezza",
                "Crossbow pistol": "halcon",
                "Long Bow": "halcon",
                "Plate Armour": "baluardo",
                "Pavise": "baluardo",
            },
        )
        by_name = {row["name"]: row for row in house["fighters"]}
        self.assertEqual(by_name["Sergeant"]["skill_types"], ["Combat", "Shooting", "Speed"])
        self.assertEqual(
            by_name["Sergeant"]["variant_changes"],
            {
                "halcon": {"skill_types": ["Combat", "Shooting", "Strength"]},
                "baluardo": {"skill_types": ["Combat", "Strength", "Speed"]},
            },
        )
        self.assertEqual(
            by_name["Commander"]["variant_changes"],
            {
                "fierezza": {"skills": ["Web of Steel"]},
                "halcon": {"skills": ["Haggle"]},
                "baluardo": {"skills": ["Battle Tongue"]},
            },
        )

    def test_throwing_axes_are_one_entry_with_the_knives_and_stars(self) -> None:
        # William, 11 Nov 2026: "there should only be one entry for throwing axes and its this one Throwing
        # Knives/Stars/Axes 15 gc Rare 5 it includes all of them ... this item is available to all just gated by its
        # setting". The PDF warbands' ruleless Throwing Axes stub is gone and their lines name this one.
        self.assertNotIn("Throwing Axes", self.items)
        merged = self.items["Throwing Knives/Stars/Axes"]
        [row] = merged["availabilities"]
        self.assertEqual((row["cost"], row["rarity"], row["for_everyone"], row["warbands"]), (15, 5, True, []))
        self.assertEqual(merged["setting"], "mordheim")  # Mordheim 1a, where it has always been
        shown = {
            (slug, line["shown_as"])
            for slug in ("dwarf-slayer-cult", "khorne-raiders", "slayer-pirates", "orc-mob")
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == merged["name"]
        }
        self.assertLessEqual(
            {
                ("dwarf-slayer-cult", "Throwing axes"),
                ("khorne-raiders", "Throwing Axes"),
                ("slayer-pirates", "Throwing Axe"),
                ("orc-mob", "Throwing Axe"),  # the Savage Orcs variant of the Orc Mob
            },
            shown,
        )

    def test_three_ruleless_stubs_are_the_items_of_ours_they_duplicated(self) -> None:
        # William, 11 Nov 2026: one entry for a weapon we already hold under another name. The Fen Guard's Whip is
        # our Steel Whip (10 gc both), the Druchii's Darksteel blade our Dark Elf Blade (Rare 9, Critical Damage and
        # Wicked Edge both) and the Snotlings' Slingshot our Sling (2 gc both), each line shown under its own name.
        retired = ("Whip", "Darksteel Blade", "Slingshot")
        self.assertEqual([name for name in retired if name in self.items], [])
        shown = {
            (slug, line["item"]["name"], line["shown_as"])
            for slug in ("fen-guard", "druchii", "snotlings")
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] in ("Steel Whip", "Dark Elf Blade", "Sling")
        }
        self.assertEqual(
            shown,
            {
                ("fen-guard", "Steel Whip", "Whip"),
                ("druchii", "Dark Elf Blade", "Darksteel blade"),
                ("snotlings", "Sling", "Slingshot"),
            },
        )
        rows = {
            name: [
                (row["cost"], row["cost_note"], row["rarity"], row["note"])
                for row in self.items[name]["availabilities"]
                if {"type": slug, "excluded": False} in row["warbands"]
            ]
            for name, slug in (("Steel Whip", "fen-guard"), ("Dark Elf Blade", "druchii"))
        }
        self.assertEqual(rows["Steel Whip"], [(10, "", None, "Heroes only")])
        self.assertEqual(rows["Dark Elf Blade"], [(None, "3 × price", 9, "Heroes only")])
        # the Sling is 2 gc for everyone already, so the Snotlings' row would say nothing new
        [sling] = self.items["Sling"]["availabilities"]
        self.assertEqual((sling["cost"], sling["for_everyone"]), (2, True))

    def test_the_kanabo_stays_its_own_item_beside_our_double_handed_weapon(self) -> None:
        # 15 gc, like our Double-handed weapon, but a different weapon: the Nipponese list sells both, and the
        # Kanabo's entry is Strength +1 with Two-Handed and Concussion where ours is +2 and strikes last
        kanabo = self.items.get("Kanabo") or {}
        self.assertEqual(kanabo.get("strength"), "As user +1")
        self.assertEqual([rule.get("rule") or rule.get("name") for rule in kanabo.get("rules") or []], ["two-handed", "Concussion"])  # fmt: skip
        lines = {
            line["item"]["name"] for row in self.templates["nipponese-expedition"]["lists"] for line in row["lines"]
        }
        self.assertLessEqual({"Kanabo", "Double-handed weapon"}, lines)

    def test_there_is_one_pike_and_the_tileans_and_house_guard_buy_it(self) -> None:
        # William, 11 Nov 2026: "the tilean one got discontinued". Pike (Tileans) is dropped and Pike (Merchant
        # Caravans) is plain Pike; its holders are the Merchant Caravans, the Tilean warbands and the House Guard.
        gone = ("Pike (Tileans)", "Pike (Merchant Caravans)")
        self.assertEqual([name for name in gone if name in self.items], [])
        pike = self.items["Pike"]
        self.assertEqual([rule.get("rule") or rule.get("name") for rule in pike["rules"]], ["strike-first", "two-handed"])  # fmt: skip
        buyers = {
            entry["type"]
            for row in pike["availabilities"]
            for entry in row["warbands"]
            if not entry["excluded"] and "type" in entry
        }
        self.assertLessEqual({"merchant-caravans", "tileans", "house-guard"}, buyers)
        lines = {
            (slug, line["cost"])
            for slug in ("tileans", "house-guard", "merchant-caravans")
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == "Pike"
        }
        self.assertEqual(lines, {("tileans", 12), ("house-guard", 10), ("merchant-caravans", 10)})

    def test_the_mousillon_censer_and_the_woodsmens_staff_are_their_own_items(self) -> None:
        # William, 11 Nov 2026: a warband's own version takes the warband's name in brackets, or the setting's where
        # several warbands share the warband's name. Three warbands are Skaven of Clan Pestilens, so the censer is
        # Mousillon's; the Woodsmen are one warband, so the staff is theirs. Ours stay as they are.
        censer = self.items["Plague Censer (Mousillon)"]
        self.assertEqual((censer["strength"], censer["setting"]), ("As user +2", "mousillon"))
        self.assertEqual([rule.get("rule") or rule.get("name") for rule in censer["rules"]], ["heavy", "two-handed", "Fog of Death"])  # fmt: skip
        [row] = censer["availabilities"]
        self.assertEqual((row["cost"], row["dice"], row["rarity"]), (75, 5, 12))
        self.assertNotIn("Toughness test", censer["rules"][-1]["text"])  # the PDF's roll, not our Censer's test
        # ours keeps the Town Cryer 29 warband's row, and the Lustria warband's, whose Fog of Death is ours
        self.assertEqual(
            [row["warbands"] for row in self.items["Censer"]["availabilities"]],
            [
                [{"type": "skaven-of-clan-pestilens-tc29", "excluded": False}],
                [{"type": "skaven-of-clan-pestilens-lus", "excluded": False}],
            ],
        )
        staff = self.items["Quarter Staff (Woodsmen de Artois)"]
        self.assertEqual(staff["strength"], "As user +1")
        self.assertEqual([rule["rule"] for rule in staff["rules"]], ["two-handed", "parry"])
        self.assertEqual([row["cost"] for row in self.items["Quarter Staff"]["availabilities"]], [15])
        shown = {
            (slug, line["item"]["name"], line["shown_as"])
            for slug, name in (
                ("skaven-of-clan-pestilens-mousillon", "Plague Censer (Mousillon)"),
                ("woodsmen-de-artois", "Quarter Staff (Woodsmen de Artois)"),
            )
            for row in self.templates[slug]["lists"]
            for line in row["lines"]
            if line["item"]["name"] == name
        }
        self.assertEqual(
            shown,
            {
                ("skaven-of-clan-pestilens-mousillon", "Plague Censer (Mousillon)", "Plague Censer"),
                ("woodsmen-de-artois", "Quarter Staff (Woodsmen de Artois)", "Quarterstaff"),
            },
        )

    def test_the_clockworkers_pistol_and_rifle_are_our_pistol_and_handgun(self) -> None:
        # William, 11 Nov 2026: "these are just nicknames". Their lines name ours, shown under the Clockworkers'
        # names, with a price row each at this PDF's price; ours keep their own 15 gc and 35 gc, Rare 8.
        self.assertEqual([name for name in ("Clockwork pistol", "Clockwork rifle") if name in self.items], [])
        shown = {
            (line["item"]["name"], line["shown_as"], line["cost"])
            for row in self.templates["clockworkers"]["lists"]
            for line in row["lines"]
            if line["item"]["name"] in ("Pistol", "Handgun")
        }
        self.assertEqual(shown, {("Pistol", "Clockwork pistol", 25), ("Handgun", "Clockwork rifle", 40)})
        for name, cost in (("Pistol", 25), ("Handgun", 40)):
            rows = [
                (row["cost"], row["rarity"])
                for row in self.items[name]["availabilities"]
                if {"type": "clockworkers", "excluded": False} in row["warbands"]
            ]
            self.assertEqual(rows, [(cost, None)])

    def test_a_warband_only_row_is_named_for_its_warband_or_for_its_setting(self) -> None:
        # William, 11 Nov 2026: the warband's name in brackets where that tells them apart, the setting's where it
        # does not, and never both. Two warbands are Night Goblins, so the Karak Azgal skills take the setting;
        # only the Dark Elf Corsairs hire their three Specialists, so those take the warband. (The Mousillon Clan
        # Pestilens skill that used to stand here, Rotten Body (Mousillon), is our Fearsome since 12 Nov 2026.)
        sneaky = sorted(row["name"] for row in load_json(OUT / "skills.json") if row["name"].startswith("Sneaky Git"))
        self.assertEqual(sneaky, ["Sneaky Git", "Sneaky Git (Karak Azgal)"])
        hired = {row["name"] for row in load_json(HIRELING_DATA / "hired-swords.json")}
        self.assertLessEqual(
            {
                "Dark Elf Sorceress (Dark Elf Corsairs)",
                "Dark Elf Beastmaster (Dark Elf Corsairs)",
                "Witch Elf (Dark Elf Corsairs)",
            },
            hired,
        )
        self.assertEqual([name for name in ("Dark Elf Sorceress", "Witch Elf") if name in hired], [])
        self.assertIn("Holy (Unholy) Relic", self.items)  # its brackets are its name, not a warband or a setting

    def test_the_sartosa_shop_items_we_lack_are_stubs_for_all_twelve_types(self) -> None:
        # William, 11 Nov 2026: "add them in as stubs if you dont have the rules for them yet, we will populate
        # later but good to know they exist". The Equipment PDF's own rules and prices are in, one row per item for
        # the setting's twelve warband types. The Quarantine Flag is its entry's 30+2D6, not the chart's 40+2D6.
        wanted = {
            "Duck-Footed Pistol": (50, None, 11),
            "Pocket Pistol": (5, None, 4),
            "Sword Pistol": (60, None, 11),
            "Powder Horn": (10, None, 6),
            "Powder Monkey": (15, None, 8),
            "Grog": (10, 1, None),
            "Raft": (40, None, None),
            "Norlander Net": (10, None, None),
            "Captain's Hat": (25, 2, 9),
            "Whalebone Charm": (15, 3, 10),
            "Silver Bullets/Arrows": (30, None, 10),
            "Banner - Jolly Roger": (40, 2, 9),
            "Banner - 'Friendly' Flag": (25, 2, 9),
            "Banner - Hourglass": (50, 2, 9),
            "Banner - Nation's Colors": (40, 2, 9),
            "Banner - Quarantine Flag": (30, 2, 9),
            "Banner - Red Flag": (40, 2, 9),
        }
        self.assertEqual(sorted(name for name in wanted if name not in self.items), [])
        rows = {}
        for name in wanted:
            # the Grade 3 Werewolf Hunting Pack buys Silver Bullets/Arrows too, at its own price (12 Nov 2026)
            row = next(a for a in self.items[name]["availabilities"] if len(a["warbands"]) == 12)
            rows[name] = (row["cost"], row["dice"], row["rarity"])
            self.assertEqual(self.items[name]["setting"], "sartosa", name)
        self.assertEqual(rows, wanted)
        # each banner carries the shared Pirate Banner rule and then its own
        banner = self.items["Banner - Red Flag"]["rules"]
        self.assertEqual([rule.get("rule") or rule.get("name") for rule in banner], ["pirate-banner", "Red Flag"])
        self.assertEqual(self.items["Powder Monkey"]["needs_rules"], True)  # no rules in either PDF read
        # the Greatcoat is our Rain Coat under another name, so it is a tag on ours rather than an item
        self.assertNotIn("Greatcoat", self.items)
        self.assertIn("greatcoat", self.items["Rain Coat"]["tags"])

    def test_a_rule_that_says_more_than_the_skill_keeps_its_text_and_the_skill(self) -> None:
        # William, 11 Nov 2026: a fighter whose rule only names one of our skills starts with the skill and the rule
        # goes (the Estalian Captain's Expert Swordsman, the Hatamoto's Ride); one that says more keeps its text and
        # starts with the skill too (the Ogre Hunter's Sabre Trainer, the Watchmen Sergeant's Falconer).
        def fighter(slug: str, name: str) -> dict[str, Any]:
            return next(row for row in self.templates[slug]["fighters"] if row["name"] == name)

        for slug, name, skill in (
            ("ogre-hunting-party", "Ogre Hunter", "Sabre Trainer"),
            ("watchmen", "Sergeant", "Falconer"),
        ):
            row = fighter(slug, name)
            self.assertEqual(row["skills"], [skill])
            self.assertIn(skill, [special["name"] for special in row["specials"]])
        for slug, name, skill in (
            ("estalian-corsairs", "Pirate Captain", "Expert Swordsman"),
            ("nipponese-expedition", "Hatamoto", "Ride [Animal]"),
        ):
            row = fighter(slug, name)
            self.assertEqual(row["skills"], [skill])
            self.assertEqual([special["name"] for special in row["specials"]], ["Leader"])

    def test_mazzalupo_and_the_order_of_the_mare_come_in_from_their_web_pages(self) -> None:
        # William, 11 Nov 2026, who gave the two mordheimer links: these are the only two warbands read from a web
        # page rather than a PDF (broheim.net serves no PDF for either, and the snapshot holds no grade 2a page),
        # written in this directory's shape, which is the shape for a warband read by hand from a document.
        for slug, link in (
            ("mazzalupo", "https://mordheimer.net/docs/warbands/grade-2a-warbands/mazzalupo"),
            ("order-of-the-mare", "https://mordheimer.net/docs/warbands/grade-2a-warbands/order-of-the-mare"),
        ):
            page, template = FILES[slug], self.templates[slug]
            self.assertEqual(page["sourceLink"], link)
            self.assertEqual(template["link_url"], link)
            self.assertEqual(template["setting"], "mordheim-2a")
            self.assertEqual((template["starting_gold"], template["max_models"]), (500, 15))
            self.assertEqual([row["type"] for row in template["types"]], [slug])
            self.assertEqual({flag["page"] for flag in page["flags"]}, {1})  # one page, the page itself
            self.assertIn("read from its mordheimer.net page", page["flags"][0]["what"])

        mazzalupo = self.templates["mazzalupo"]
        knight = next(row for row in mazzalupo["fighters"] if row["name"] == "Wandering knight")
        # his Commands are learned as spells are and cast as magic, so they are a lore; he "does not count as a
        # wizard", which our model says as Priest, as the Vampire Hunters' Priest of Morr does
        lores = [lore["name"] for lore in knight["spell_types"]]
        self.assertEqual((knight["caster"], lores), ("Priest", ["Commands (Mazzalupo)"]))
        self.assertEqual(knight["skills"], ["Ride [Animal]"])  # "has the Riding (horses) skill"
        finances = next(row for row in mazzalupo["fighters"] if row["name"] == "Master of finances")
        self.assertEqual(finances["skills"], ["Haggle"])
        sheep = next(row for row in mazzalupo["fighters"] if row["name"] == "Black sheep")
        # not our shared Stupidity: it holds only while no Sheepherder is within 6"
        self.assertIn("Stupidity (Black sheep)", [special["name"] for special in sheep["specials"]])
        self.assertNotIn("Bearcloak", self.items)  # our Wolfcloak under another name (William, 12 Nov 2026)

        mare = self.templates["order-of-the-mare"]
        dame = next(row for row in mare["fighters"] if row["name"] == "Dame of the Mare")
        lores = [lore["name"] for lore in dame["spell_types"]]
        self.assertEqual((dame["caster"], lores), ("Priest", ["Blessings of the Mare"]))
        virtue = [row["name"] for row in mare["fighters"] if "Knight's virtue" in [s["name"] for s in row["specials"]]]
        self.assertEqual(
            virtue, ["Paragon", "Gallant", "Redeemed knight"]
        )  # the rule they point at, not a warband rule
        self.assertNotIn("Knight's virtue", [rule["title"] for rule in mare["rules"]])

    def test_the_orc_pirates_and_the_savage_orcs_are_variants_of_the_orc_mob(self) -> None:
        # William, 11 Nov 2026: "Orc Pirates & Savage Orcs should just be 2 variants of the orc mob if that still
        # works, correctly pointing at their settings". Their pages fold into the Orc Mob's (`variantOf`), which
        # serves all three types, each presetting its own variant so nobody picks another setting's warband.
        types = {row["slug"]: row for row in load_json(OUT / "warband-types.json")}
        self.assertEqual([slug for slug in ("orc-pirates-and-savage-orcs",) if slug in types], [])
        self.assertEqual(
            [(types[slug]["name"], types[slug]["setting"]) for slug in ("orc-mob", "orc-pirates", "savage-orcs-sar")],
            [("Orc Mob", "mordheim"), ("Orc Pirates", "sartosa"), ("Savage Orcs", "sartosa")],
        )
        self.assertEqual([slug for slug in ("orc-pirates", "savage-orcs") if slug in self.templates], [])
        mob = self.templates["orc-mob"]
        self.assertEqual([row["key"] for row in mob["variants"]], ["orc-mob", "orc-pirates", "savage-orcs"])
        self.assertEqual(
            mob["types"],
            [
                {"type": "orc-mob", "variant": "orc-mob"},
                {"type": "orc-pirates", "variant": "orc-pirates"},
                {"type": "savage-orcs-sar", "variant": "savage-orcs"},
            ],
        )
        # each half's rules are its variant's; Da Mob's own are every variant's
        self.assertEqual(
            [(row["title"], row["variant"]) for row in mob["rules"]],
            [
                ("Distasteful Company", ""),
                ("Animosity", ""),
                ("Pressganging", "orc-pirates"),
                ("Talismans galore", "savage-orcs"),
                ("Fear fire", "savage-orcs"),
                ("Primitive", "savage-orcs"),
                ("Wild Animosity", "savage-orcs"),
            ],
        )
        # every line names the variant that buys it, Da Mob's own included
        self.assertEqual(
            {(row["name"], line["variant"]) for row in mob["lists"] for line in row["lines"]},
            {
                ("Orc Equipment List", "orc-mob"),
                ("Goblin Equipment List", "orc-mob"),
                ("Orc Equipment List", "orc-pirates"),
                ("Goblin Swabbie Equipment List", "orc-pirates"),
                ("Savage Orc Equipment List", "savage-orcs"),
                ("Forest Goblin Equipment List", "savage-orcs"),
            },
        )
        # a fighter a variant has none of is in its `variant_changes` as a most of 0
        allowed = {
            variant: sorted(
                row["name"]
                for row in mob["fighters"]
                if (row["variant_changes"].get(variant) or {}).get("max_count") != 0
            )
            for variant in ("orc-mob", "orc-pirates", "savage-orcs")
        }
        self.assertEqual(
            allowed,
            {
                "orc-mob": [
                    "Cave Squig",
                    "Goblin Warrior",
                    "Orc Big \u2018Un",
                    "Orc Boss",
                    "Orc Boy",
                    "Orc Shaman",
                    "Troll",
                ],  # fmt: skip
                "orc-pirates": [
                    "Goblin Enjuneer",
                    "Goblin Swabbie",
                    "Orc Big \u2018Un",
                    "Orc Boss",
                    "Orc Boy",
                    "Orc Shaman",
                    "Sea Squig",
                    "Sea Troll",
                ],  # fmt: skip
                "savage-orcs": [
                    "Cave Squig",
                    "Forest Goblin",
                    "Orc Big \u2018Un",
                    "Orc Boss",
                    "Orc Boy",
                    "Orc Shaman",
                    "Troll",
                ],  # fmt: skip
            },
        )
        # only the Savage Orcs learn their four skills; every variant's heroes learn our Orcs group
        boss = next(row for row in mob["fighters"] if row["name"] == "Orc Boss")
        self.assertNotIn("Savage Orcs", boss["skill_types"])
        self.assertIn("Orcs", boss["skill_types"])
        self.assertEqual(
            boss["variant_changes"]["savage-orcs"]["skill_types"],
            ["Combat", "Shooting", "Strength", "Speed", "Savage Orcs", "Orcs"],
        )

    def test_a_price_row_gives_every_warband_type_it_names_one_row(self) -> None:
        # Sartosa's shop list, one row for the setting's twelve types rather than a copy in each page
        page = good_page()
        page["priceRows"] = [
            {"name": "sword", "rarity": 5, "dice": None, "types": ["witch-hunters", "sisters-of-sigmar"], "page": 10}
        ]
        put_aliases_right(page)
        items: list[dict[str, Any]] = [{**item, "availabilities": []} for item in ITEMS]
        types = [*TYPES, {"slug": "sisters-of-sigmar", "setting": "sylvania"}]
        add_price_rows({"witch-hunters": page}, items, types)
        [row] = items[1]["availabilities"]
        self.assertEqual(
            row["warbands"],
            [{"type": "witch-hunters", "excluded": False}, {"type": "sisters-of-sigmar", "excluded": False}],
        )

    def test_the_sartosa_shop_list_is_declared_once_for_its_twelve_types(self) -> None:
        # William, 11 Nov 2026 (decision 20): the setting's Equipment PDF (p10) re-prices our items for its warbands
        rows = [row for row in self.items["Blunderbuss"]["availabilities"] if row["cost"] == 30 and row["rarity"] == 7]
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]["warbands"]), 12)  # eleven types until the Orc Pirates split in two
        self.assertIn({"type": "sartosan-pirates", "excluded": False}, rows[0]["warbands"])

    def test_low_kings_buy_our_spiked_gauntlet_and_the_maps_share_their_rule(self) -> None:
        # William, 6 Nov 2026: one Spiked Gauntlet; the Magic Acorn "is 100 just for the mootlanders on initial buy", a
        # list price, which the app keeps to the starting warband ("i thought all list items were at their starting
        # only price"); "Make the map rule not unique to the items, give it to both marienburg and mordheim map"
        gauntlet = self.items["Spiked Gauntlet"]
        self.assertIn(
            (15, 7, [{"type": "low-kings", "excluded": False}], "Enforcer only"),
            [(row["cost"], row["rarity"], row["warbands"], row["note"]) for row in gauntlet["availabilities"]],
        )
        self.assertNotIn("Spiked Gauntlet (Low Kings)", self.items)
        lines = [line for row in self.templates["militant-mootlanders"]["lists"] for line in row["lines"]]
        [acorn] = [line for line in lines if line["item"]["name"] == "Magic Acorn"]
        self.assertEqual((acorn["cost"], acorn["note"]), (100, ""))
        self.assertEqual(self.items["Pneumatic Arm"]["rules"][-1], {"rule": "experimental-technology"})
        self.assertEqual(self.items["Pneumatic Arm"]["rules"][0]["name"], "Harness")
        for name in ("Mordheim Map", "Marienburg Map"):
            self.assertEqual(self.items[name]["rules"], [{"rule": "map"}])

    def test_half_a_price_rounds_up(self) -> None:
        # William, 6 Nov 2026: "yes always round up in mordheim for gold"
        self.assertEqual([halved(cost) for cost in (40, 35, None)], [20, 18, None])

    def test_each_file_is_a_template_of_its_type_with_its_stubs(self) -> None:
        types = {row["slug"]: row for row in load_json(OUT / "warband-types.json")}
        for slug, page in FILES.items():
            if page.get("variantOf"):
                continue  # it folds into another warband's list as one of its variants (the Orc Pirates)
            with self.subTest(file=slug):
                # a template is slugged by its name, which may spell its type otherwise (Militant Mootlanders is the
                # type militiant-mootlanders, the source's spelling)
                template = self.templates[slugify(page["name"])]
                self.assertEqual(template["types"], [{"type": slug, "variant": ""}])
                self.assertEqual(
                    (template["setting"], template["link_url"], len(template["fighters"])),
                    (types[slug]["setting"], page["sourceLink"], len(page["fighters"])),
                )
                for stub in page["stubs"]:
                    self.assertEqual(self.items[stub["name"]]["origin"], ORIGIN)

    def test_the_halfling_cook_buys_from_his_own_list_under_his_names(self) -> None:
        # William, 6 Nov 2026: "do we not add labels to his owning of those items? but yes all items that exist"
        halflings = self.templates["halflings"]
        cook = next(fighter for fighter in halflings["fighters"] if fighter["name"] == "Halfling Cook")
        [key] = cook["lists"]
        lines = next(row for row in halflings["lists"] if row["key"] == key)["lines"]
        names = {(line["item"]["name"], line["shown_as"], line["cost"]) for line in lines}
        self.assertLessEqual(
            {
                ("Dagger", "Pairing Knife", 2),
                ("Tenderiser", "", 3),
                ("Cleaver", "Meat Cleaver", 5),
                ("Sword", "Machete", 10),
                ("Helmet", "Cooking Pot", 10),  # William, 6 Nov 2026: "still just a regular helmet"
            },
            names,
        )

    def test_a_group_notes_who_takes_its_shared_skills_and_a_skill_may_be_in_two_groups(self) -> None:
        # William, 6 Nov 2026: the Ogre Hunting Party's race limits on our skills are its group's note, and
        # Excellent Sight, kept apart from our Unblinking Eye ("keep both of those separate"), is the Druchii's and
        # the Wood Elves' both
        groups = {row["name"]: row for row in load_json(OUT / "skill-groups.json")}
        self.assertEqual(
            groups["Ogre Hunting Party"]["note"],
            "Ogres only: Maneater, Bull Charge, Bellowing Roar (the leader only). Gnoblars only: Infiltration.",
        )
        for name in ("Druchii", "Wood Elves of Athel Loren"):
            self.assertIn("Excellent Sight", groups[name]["skills"])
        sight = [row for row in load_json(OUT / "skills.json") if row["name"] == "Excellent Sight"]
        self.assertEqual(len(sight), 1)

    def test_an_item_ours_by_another_name_shows_the_pdfs(self) -> None:
        # William, 6 Nov 2026: the Power Squig is our Familiar (special equipment), Holy Water our Blessed Water and
        # the Warhammer our Sigmarite Warhammer, each shown under the PDF's name
        def shown(slug: str) -> set[tuple[str, str]]:
            rows = self.templates[slug]["lists"]
            return {(line["item"]["name"], line["shown_as"]) for row in rows for line in row["lines"]}

        self.assertIn(("Familiar", "Power Squig"), shown("snotlings"))
        self.assertLessEqual(
            {("Blessed Water", "Holy Water"), ("Sigmarite Warhammer", "Warhammer")}, shown("protectorate-of-sigmar")
        )

    def test_a_fighter_starts_with_the_skills_his_page_names(self) -> None:
        # William, 7 Nov 2026, of a rule that only named a skill: "yes please do that". The Mousillon Clan Pestilens
        # PDF (p5) says the Plague Priest and the Plague Champion start with the Resilient Strength skill, so each
        # holds the skill itself and neither keeps a rule saying so.
        pestilens = self.templates["skaven-of-clan-pestilens-mousillon"]
        held = {row["name"]: (row["skills"], [rule["name"] for rule in row["specials"]]) for row in pestilens["fighters"]}  # fmt: skip
        self.assertEqual(held["Plague Priest"], (["Resilient"], ["Leader", "Frenzy"]))
        self.assertEqual(held["Plague Champion"], (["Resilient"], ["Frenzy"]))
        self.assertEqual(held["Monk Initiate"][0], [])

    def test_a_priest_of_morr_casts_his_funerary_rites_as_a_priest(self) -> None:
        # the Vampire Hunters of Sylvania's PDF (p11): "Priests of Morr are not wizards"
        for slug in ("vampire-hunters-of-sylvania", "dreamwalkers-cult-of-morr"):
            priest = next(row for row in self.templates[slug]["fighters"] if row["name"] == "Priest of Morr")
            self.assertEqual(priest["caster"], "Priest", slug)

    def test_clan_moulders_twistkin_sells_the_rulebooks_mutations_at_half_price(self) -> None:
        # the Twistkin skill (PDF p4): a Stormvermin buys one of the rulebook's mutations at half its listed cost
        upgrades = self.templates["skaven-of-clan-moulder"]["upgrades"]
        prices = {row["special"]["name"]: (row["cost"], row["cost_note"]) for row in upgrades}
        self.assertEqual(prices["Daemon Soul"], (10, ""))
        self.assertEqual(prices["Great Claw"], (25, ""))
        self.assertEqual((prices["Tentacle"], prices["Spines"]), ((18, ""), (18, "")))
        self.assertEqual(len(prices), 9)
        self.assertEqual(
            {(str(row["who"]), row["max_per_fighter"]) for row in upgrades}, {("{'fighters': ['stormvermin']}", 1)}
        )
