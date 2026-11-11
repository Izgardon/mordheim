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
    add_price_rows,
    page_item_rules,
    put_aliases_right,
    stub_items,
    tables_as_html,
)
from catalogue_import.sources import OUT
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
                "price row 'pry bar': no item of ours (a stub has its own row)",
            ],
        )

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
        # a setting's shop list is declared once (Sartosa's, for its eleven types), and names types of ours
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

    def test_a_price_row_gives_every_warband_type_it_names_one_row(self) -> None:
        # Sartosa's shop list, one row for the setting's eleven types rather than a copy in each page
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

    def test_the_sartosa_shop_list_is_declared_once_for_its_eleven_types(self) -> None:
        # William, 11 Nov 2026 (decision 20): the setting's Equipment PDF (p10) re-prices our items for its warbands
        rows = [row for row in self.items["Blunderbuss"]["availabilities"] if row["cost"] == 30 and row["rarity"] == 7]
        self.assertEqual(len(rows), 1)
        self.assertEqual(len(rows[0]["warbands"]), 11)
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
