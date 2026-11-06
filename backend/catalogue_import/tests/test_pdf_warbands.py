"""The warbands read from their PDFs (pdf_warbands.py, pdf_check.py): every source file in `sources/pdf-warbands/`
passes the check, the check finds what a bad file gets wrong, and the import builds each file's template, stubs and
skill group by the snapshot's code path."""

from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.common import load_json
from catalogue_import.pdf_check import Catalogue, check_page, load_catalogue
from catalogue_import.pdf_warbands import ORIGIN, PDF_SOURCES, put_aliases_right, stub_items, tables_as_html
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
    ItemIndex(ITEMS), {"Combat": {"Brave"}}, {"brave"}, {"Human"}, {"Lesser Magic"}, {"witch-hunters"}
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

    def test_half_a_price_rounds_up(self) -> None:
        # William, 6 Nov 2026: "yes always round up in mordheim for gold"
        self.assertEqual([halved(cost) for cost in (40, 35, None)], [20, 18, None])

    def test_each_file_is_a_template_of_its_type_with_its_stubs(self) -> None:
        types = {row["slug"]: row for row in load_json(OUT / "warband-types.json")}
        for slug, page in FILES.items():
            with self.subTest(file=slug):
                template = self.templates[slug]
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
                ("Cooking Pot Helmet", "Cooking Pot", 10),
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
