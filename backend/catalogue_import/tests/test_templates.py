"""The warband templates import (templates.py and its parts): rule text cleaned, list lines matched to our items with
their prices and who may take them, fighters with their written profile, race, skill groups by variant, lores and
rules, and the warband rules with their variants and William's titles."""

from typing import Any

from django.test import SimpleTestCase

from catalogue_import.template_fighters import (
    FighterLog,
    build_fighter,
    plural_of,
    profile,
    race_of,
    skill_types,
    variant_numbers,
)
from catalogue_import.template_lists import Fighter, ItemIndex, line_price, read_note
from catalogue_import.template_parts import ListLog, build_lists, build_rules
from catalogue_import.template_text import clean_rule, clean_title
from catalogue_import.template_upgrades import UpgradeLog, build_upgrades
from catalogue_import.templates import TemplateLog, hero_skills

ITEMS = [
    {"name": "Dagger", "variant": "", "slug": "dagger", "tags": ["dagger", "daggers"]},
    {"name": "Pike (Merchant Caravans)", "variant": "", "slug": "pike-merchant-caravans", "tags": ["pike"]},
    {"name": "Pike (Tileans)", "variant": "", "slug": "pike-tileans", "tags": ["pike"]},
    {"name": "Sunstaff (Lustria)", "variant": "", "slug": "sunstaff-lustria", "tags": []},
    {"name": "Club, Mace or Hammer", "variant": "", "slug": "club-mace-or-hammer", "tags": ["club", "mace", "hammer"]},
    {"name": "Gromril Weapon", "variant": "", "slug": "gromril-weapon", "tags": []},
    {"name": "Lantern", "variant": "Mutiny in Marienburg", "slug": "lantern-mim", "tags": ["lantern"]},
    {"name": "Lantern", "variant": "", "slug": "lantern", "tags": ["lantern"]},
]
FIGHTERS = [
    Fighter("captain", "hero", "Mercenary Captain", "Mercenary Captains", "human"),
    Fighter("gaolers", "hero", "Gaoler", "Gaolers", "black dwarf"),
    Fighter("questing-knight", "hero", "Questing Knight", "Questing Knights", "human"),
    Fighter("marksmen", "henchman", "Marksman", "Marksmen", "human"),
    Fighter("bulls", "henchman", "Bull", "Bulls", "ogre"),
]


class RuleTextTests(SimpleTestCase):
    def test_wraps_join_breaks_become_paragraphs_and_markers_go(self) -> None:
        text = 'Fighters may use\nhis Leadership.<Tooltip content="faq23">❓</Tooltip>\n\n<br /><br />Marksmen add +1.'
        self.assertEqual(clean_rule(text), "Fighters may use his Leadership.\n\nMarksmen add +1.")

    def test_a_link_keeps_its_url_and_an_anchor_its_text(self) -> None:
        text = 'Uses <a href="/docs/magic/lesser-magic">Lesser Magic</a> or <a href="#tchar">Tchar Rituals</a>.'
        self.assertEqual(
            clean_rule(text), "Uses Lesser Magic (https://mordheimer.net/docs/magic/lesser-magic) or Tchar Rituals."
        )

    def test_a_table_becomes_lines_of_cells_and_a_title_loses_its_colon(self) -> None:
        text = "Roll:<table><tr><th>D6</th><th>Result</th></tr><tr><td>1</td><td>Squabble</td></tr></table>"
        self.assertEqual(clean_rule(text), "Roll:\n\nD6 | Result\n1 | Squabble")
        self.assertEqual(clean_title("Natives:"), "Natives")


class ListLineTests(SimpleTestCase):
    index = ItemIndex(ITEMS)

    def test_an_item_named_for_the_warband_comes_first(self) -> None:
        self.assertEqual(self.index.find("pike", ["Merchant Caravans"])[0]["name"], "Pike (Merchant Caravans)")  # type: ignore[index]
        self.assertEqual(self.index.find("pike", ["Tileans"])[0]["name"], "Pike (Tileans)")  # type: ignore[index]

    def test_a_tag_a_slug_an_escape_and_mordheimers_entry_before_mims(self) -> None:
        found = {name: self.index.find(name) for name in ("mace", "sunstaff-lustria", "gromril weapon\\", "lantern")}
        self.assertEqual(
            {name: (item["slug"] if item else None, how) for name, (item, how) in found.items()},
            {
                "mace": ("club-mace-or-hammer", "a tag"),
                "sunstaff-lustria": ("sunstaff-lustria", "its slug"),
                "gromril weapon\\": ("gromril-weapon", ""),
                "lantern": ("lantern", ""),
            },
        )
        self.assertEqual(self.index.find("war chain"), (None, ""))

    def test_prices_free_daggers_braces_and_multiples(self) -> None:
        free, brace = line_price({"costPrefix": "1st free/", "cost": 2}), line_price({"cost": 15, "braceCost": 30})
        thrice, blade = line_price({"cost": "", "costPrefix": "3 x Price"}), line_price({"costMod": "+15gc"})
        self.assertEqual((free.cost, free.first_free, brace.cost, brace.brace_cost), (2, True, 15, 30))
        self.assertEqual(
            (thrice.cost, thrice.cost_note, blade.cost, blade.cost_note), (None, "3 × price", None, "+15 gc")
        )

    def test_who_may_take_a_line_its_limit_or_its_brace(self) -> None:
        notes = {
            "Gaolers only": {"fighters": ["gaolers"]},
            "(Heroes only)": {"heroes": True},
            "Available to Heroes and Marksmen only": {"heroes": True, "fighters": ["marksmen"]},
            "Not Questing Knight": {"except": ["questing-knight"]},
            "Only available to the Mercenary Captain.": {"fighters": ["captain"]},
            "Ogres only": {"fighters": ["bulls"]},
        }
        for note, who in notes.items():
            with self.subTest(note=note):
                self.assertEqual(read_note(note, FIGHTERS).who, who)
        self.assertEqual(read_note("Max 3 per warband", FIGHTERS).warband_max, 3)
        self.assertEqual(read_note("One per warband", FIGHTERS).warband_max, 1)
        self.assertEqual(read_note(" (30 for a brace)", FIGHTERS).brace_cost, 30)
        unread = read_note("Trantio 5 gc cheaper at the start", FIGHTERS)
        self.assertEqual((unread.read, unread.note), (False, "Trantio 5 gc cheaper at the start"))
        self.assertTrue(read_note('<sup><Tooltip content="err11">✏️</Tooltip></sup>', FIGHTERS).read)


def warband_page(**fields: Any) -> dict[str, Any]:
    captain = {
        "id": "captain",
        "type": "hero",
        "name": "Captain",
        "plural": "Captains",
        "race": "human",
        "minQty": 1,
        "maxQty": 1,
        "costGc": 60,
        "startingXp": 20,
        "statblock": {"m": 4, "ws": 4, "bs": 4, "s": 3, "t": 3, "w": 1, "i": 4, "a": "1(2)", "ld": 8},
        "equipmentLists": ["kit"],
        "skillAccess": [
            {"subfaction": "Reikland Mercenaries", "skills": {"combat": True, "shooting": True}},
            {"subfaction": "Middenheim Mercenaries", "skills": {"combat": True, "strength": True}},
        ],
        "specialRules": [
            {"rulename": "Leader", "ruleFull": "Leads."},
            {"rulename": "Large Target", "ruleFull": "Big."},
            {"rulename": "Wizard", "ruleFull": "Casts."},
        ],
    }
    return {
        "name": "Mercenaries",
        "fighters": [captain],
        "equipmentLists": [
            {"id": "kit", "title": "Kit", "caveat": "", "items": [{"name": "dagger", "cost": {"cost": 2}}]}
        ],
        "specialRules": [],
        **fields,
    }


VARIANTS = [
    {"key": "reikland", "name": "Reikland", "subfaction": "Reikland Mercenaries", "heading": "Reikland"},
    {"key": "middenheim", "name": "Middenheim", "subfaction": "Middenheim Mercenaries", "heading": "Middenheim"},
]


class FakeLores:
    def of(self, page: str, name: str) -> list[dict[str, str]]:
        return [{"name": "Lesser Magic", "note": ""}] if name == "Captain" else []


class FighterTests(SimpleTestCase):
    def test_a_fighter_in_the_templates_shape(self) -> None:
        log = FighterLog()
        context = {"variants": VARIANTS, "races": {"Human"}, "lores": FakeLores(), "owner": "Warband - Mercenaries"}
        captain = build_fighter("mercenaries", warband_page()["fighters"][0], context, ["kit"], log)
        self.assertEqual(
            (captain["key"], captain["kind"], captain["race"], captain["cost"], captain["starting_xp"]),
            (
                "captain",
                "hero",
                "Human",
                60,
                20,
            ),
        )
        self.assertEqual((captain["min_count"], captain["max_count"], captain["stats"]["attacks"]), (1, 1, "1(2)"))
        self.assertEqual(
            (captain["skill_types"], captain["variant_changes"]),
            (
                ["Combat", "Shooting"],
                {"middenheim": {"skill_types": ["Combat", "Strength"]}},
            ),
        )
        self.assertEqual((captain["is_leader"], captain["large"], captain["caster"]), (True, True, "Wizard"))
        self.assertEqual(
            captain["specials"],
            [
                {"name": "Leader", "type": "Warband - Mercenaries", "description": "Leads."},
                {"name": "Large", "type": "Trait"},
                {"name": "Wizard", "type": "Caster"},
            ],
        )
        self.assertEqual(log.written, [("mercenaries", "Captain", {"attacks": "1(2)"})])

    def test_the_special_tick_names_the_warbands_group_and_a_hero_his_own(self) -> None:
        log = FighterLog()
        slayer = {"name": "Dwarf Troll Slayer", "skillAccess": {"combat": True, "special": True}}
        noble = {"name": "Dwarf Noble", "skillAccess": {"academic": True, "special": True}}
        self.assertEqual(skill_types("dwarf-treasure-hunters", slayer, [], log)[0], ["Combat", "Dwarf Troll Slayers"])
        self.assertEqual(skill_types("dwarf-treasure-hunters", noble, [], log)[0], ["Academic", "Dwarves"])
        knight = {"name": "Knight", "skillAccess": {"combat": True, "special": True}}
        self.assertEqual(skill_types("imperial-outriders", knight, [], log)[0], ["Combat"])
        self.assertEqual(log.no_special_group, [("imperial-outriders", "Knight")])

    def test_a_variants_numbers_change_his_profile_as_written_and_his_most(self) -> None:
        changes: dict[str, Any] = {"middenheim": {"skill_types": ["Combat"]}}
        variant_numbers("mercenaries", "Champion", {"strength": 3, "ballistic_skill": 3}, changes)
        self.assertEqual(changes, {"middenheim": {"skill_types": ["Combat"], "stats": {"strength": 4}}})
        written: dict[str, Any] = {}
        variant_numbers("tileans", "Captain", {"leadership": "8(9)"}, written)
        self.assertEqual(written, {"remas": {"stats": {"leadership": "9(9)"}}})
        hounds: dict[str, Any] = {}
        variant_numbers("marauders-of-chaos", "Warhound of Chaos", {}, hounds)
        self.assertEqual(hounds, {"kurgan": {"max_count": None}})

    def test_a_plurals_mens_slip_is_mended(self) -> None:
        self.assertEqual(plural_of({"plural": "Marksmens"}), "Marksmen")
        self.assertEqual(plural_of({"plural": "Cabin Boys"}), "Cabin Boys")
        self.assertEqual(plural_of({}), "")

    def test_the_beastmens_minotaur_takes_our_minotaur(self) -> None:
        log = FighterLog()
        minotaur = {"name": "Minotaur", "race": ""}
        self.assertEqual(race_of("beastmen-raiders", minotaur, {"Minotaur"}, log), "Minotaur")
        self.assertIsNone(race_of("cursed-cavalcade", {"name": "Aristocrat", "race": ""}, set(), log))
        self.assertEqual(log.no_race, [("cursed-cavalcade", "Aristocrat", "")])

    def test_only_the_first_of_several_profiles_is_kept(self) -> None:
        log = FighterLog()
        cart = {"name": "Plague Cart", "statblock": [{"title": "Cart", "m": "-", "t": 8}, {"title": "Wheel", "t": 6}]}
        self.assertEqual(profile("carnival-of-chaos", cart, log)["toughness"], 8)
        self.assertEqual(log.several_profiles, [("carnival-of-chaos", "Plague Cart", ["Cart", "Wheel"])])


class PartsTests(SimpleTestCase):
    def test_rules_take_their_variant_and_the_untitled_williams_titles(self) -> None:
        page = warband_page(
            specialRules=[
                {"heading": "Middenheim", "rulename": "Middenheimer Special rules", "ruleFull": "S4."},
                {"heading": "Ostermark", "rulename": "Ostermarker Special rules", "ruleFull": "Hounds."},
                {"rulename": "Hard Head", "ruleFull": "Ignores maces."},
            ]
        )
        log = ListLog()
        rules = build_rules("mercenaries", page, VARIANTS, log)
        self.assertEqual(
            [(rule["title"], rule["variant"], rule["type"]) for rule in rules],
            [
                ("Middenheimer Special rules", "middenheim", ""),
                ("Ostermarker Special rules", "", "ostermarkers"),
                ("Hard Head", "", ""),
            ],
        )
        self.assertEqual(log.rule_only, [("mercenaries", "Ostermark", "Ostermarker Special rules", "ostermarkers")])
        untitled = build_rules(
            "bretonnian", warband_page(specialRules=[{"rulename": "", "ruleFull": "Pray."}]), [], log
        )
        self.assertEqual(untitled[0]["title"], "Blessing of the Lady")

    def test_special_equipment_is_a_list_every_buyer_has(self) -> None:
        equipment = [{"title": "Dagger", "cost": {"cost": 0}, "availability": "Rare 10 (Captain only)", "maxQty": 1}]
        lists, keys = build_lists("mercenaries", warband_page(specialEquipment=equipment), ItemIndex(ITEMS), ListLog())
        self.assertEqual([entry["key"] for entry in lists], ["kit", "special-equipment"])
        [line] = lists[1]["lines"]
        self.assertEqual(
            (line["cost"], line["cost_note"], line["who"], line["warband_max"]),
            (
                None,
                "No price in the source",
                {"fighters": ["captain"]},
                1,
            ),
        )
        self.assertEqual(keys, {"Captain": ["kit", "special-equipment"]})

    def test_upgrades_give_specials_and_their_group_text_is_a_rule(self) -> None:
        mutations = [
            {
                "mutationName": "Mutations",
                "mutationflavour": "Bought when recruited.",
                "items": [{"heading": "daemon soul", "cost": "20", "ruleFull": "A 4+ save."}],
            }
        ]
        upgrades, rules = build_upgrades("mercenaries", warband_page(mutations=mutations), "Warband - Cult")
        self.assertEqual(
            upgrades,
            [
                {
                    "group": "Mutations",
                    "special": {"name": "Daemon Soul", "type": "Warband - Cult", "description": "A 4+ save."},
                    "cost": 20,
                    "cost_note": "",
                    "note": "",
                    "who": {},
                    "max_per_fighter": None,
                    "later_double": False,
                    "at_recruit": False,
                }
            ],
        )
        self.assertEqual(
            rules, [{"title": "Mutations", "description": "Bought when recruited.", "variant": "", "type": ""}]
        )

    def test_williams_upgrade_terms_and_an_entry_that_is_a_rule(self) -> None:
        markings = {
            "mutationName": "Sacred markings",
            "mutationflavour": "",
            "items": [
                {"heading": "Oversized Jaws", "cost": "40", "ruleFull": "Bites. (Saurus Only)"},
                {"heading": "Mark of the Old Ones", "cost": "50", "ruleFull": "Re-rolls."},
            ],
        }
        equipment = {
            "mutationName": "New Equipment",
            "mutationflavour": "",
            "items": [{"heading": "Poisoned Weapons", "cost": "", "ruleFull": "Skinks brew poisons."}],
        }
        log = UpgradeLog()
        page = warband_page(mutations=[equipment, markings])
        upgrades, rules = build_upgrades("lizardmen", page, "Warband - Lizardmen", log)
        terms = [(row["who"], row["max_per_fighter"], row["later_double"], row["at_recruit"]) for row in upgrades]
        self.assertEqual(
            terms, [({"fighters": ["saurus-totem-warrior"]}, 1, False, True), ({"heroes": True}, 1, False, True)]
        )
        self.assertEqual(rules, [{"title": "Poisoned Weapons", "description": "Skinks brew poisons.", "variant": "", "type": ""}])  # fmt: skip
        self.assertEqual(log.as_rules, [("lizardmen", "Poisoned Weapons")])
        self.assertEqual(log.unknown_keys, [("lizardmen", "Oversized Jaws", "saurus-totem-warrior")])
        marks = {"mutationName": "Mark of the Dark Gods", "items": [{"heading": "Mark of Tchar", "cost": ""}]}
        [mark], _rules = build_upgrades("marauders-of-chaos", warband_page(mutations=[marks]), "Warband - Marauders")
        self.assertEqual((mark["cost"], mark["max_per_fighter"], mark["at_recruit"]), (0, 1, False))

    def test_a_variants_own_lines_and_the_skills_it_gives_every_hero(self) -> None:
        items = [*ITEMS, {"name": "Bow", "variant": "", "slug": "bow", "tags": ["bow"]}]
        page = warband_page(
            name="Marauders of Chaos",
            equipmentLists=[
                {"id": "hero-equipment-list", "title": "Heroes", "items": [{"name": "dagger", "cost": {"cost": 2}}]}
            ],
        )
        log = ListLog()
        lists, _keys = build_lists("marauders-of-chaos", page, ItemIndex(items), log)
        lines = [(line["item"]["name"], line["cost"], line["variant"]) for line in lists[0]["lines"]]
        self.assertEqual(lines, [("Dagger", 2, ""), ("Bow", 10, "kurgan")])
        self.assertIn(("marauders-of-chaos", "henchmen-equipment-list", "Bow"), log.unmatched)  # no such list here
        self.assertIn(("marauders-of-chaos", "hero-equipment-list", "Warhorse"), log.unmatched)
        fighters = [{"kind": "hero", "variant_changes": {}}, {"kind": "henchman", "variant_changes": {}}]
        template_log = TemplateLog()
        hero_skills("marauders-of-chaos", fighters, template_log)
        self.assertEqual([row["variant_changes"] for row in fighters], [{"hung": {"skills": ["Ride [Animal]"]}}, {}])
