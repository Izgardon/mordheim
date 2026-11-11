"""The catalogue seeders on the committed data (pass 5; BUG-17, BUG-51, BUG-54, CAT-TEST-12, -13).

`seed_all` runs `seed_settings`, `seed_warband_types`, `seed_races`, `seed_items`, `seed_skills`, `seed_spells_and_special`,
`seed_bestiary`, `seed_dramatis_personae`, `seed_warband_templates`, then `seed_hired_swords`, each upserting the book by name (and type) in its
own transaction, and `seed_catalogue_if_empty` runs it on a wiped production database. It works on an empty database and again later, also once a campaign holds
an entry of a book entry's name and type (a custom override, a house-rule clone, and every version PR C's
copy-on-write makes): the seeders read and write the book only (BUG-17). Small, file-driven seeder cases are in
`test_catalogue_characterisation_seeders.py`.
"""

import re
from collections import Counter
from contextlib import redirect_stdout
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign, CampaignHouseRule, CampaignType
from apps.core.seeding import STAT_FIELDS
from apps.hirelings.fees import make_fee
from apps.hirelings.models import DramatisPersona, HiredSword, HiredSwordItem, HiredSwordSkill
from apps.items.models import Item, ItemAvailability, ItemRule
from apps.items.services import sync_half_price_armour_for_campaign
from apps.races.models import Race
from apps.skills.models import Skill, SkillGroup
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateList,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)
from apps.warbands.models import WarbandGroup, WarbandType

BOOK_MODELS = (
    Race,
    Item,
    ItemRule,
    Skill,
    SkillGroup,
    Spell,
    Special,
    BestiaryEntry,
    HiredSword,
    DramatisPersona,
    WarbandTemplate,
)
TEMPLATE_ROWS = (WarbandTemplateType, TemplateFighter, TemplateList, TemplateListItem, TemplateRule, TemplateUpgrade)


def seed_all() -> str:
    """Run seed_all and return everything it and its seeders printed (they write to sys.stdout)."""
    output = StringIO()
    with redirect_stdout(output):
        call_command("seed_all")
    return output.getvalue()


def counts() -> dict[str, int]:
    return {model.__name__: model.objects.count() for model in BOOK_MODELS}


class SeedAllTests(TestCase):
    """`seed_all` once on an empty database (class data); each test may seed again inside its own transaction."""

    output: str
    seeded: dict[str, int]

    @classmethod
    def setUpTestData(cls) -> None:
        cls.output = seed_all()
        cls.seeded = counts()

    def unresolved(self, output: str) -> list[str]:
        return sorted(line.strip() for line in output.splitlines() if "not found for" in line)

    def test_an_empty_database_gets_the_whole_book_and_nothing_else(self):
        # CAT-TEST-12 (first half): the run gunicorn's seed_catalogue_if_empty starts on a wiped database
        self.assertIn("All seed commands completed successfully!", self.output)
        self.assertEqual(
            self.seeded,
            {
                "Race": 47,  # 27, the templates' Undead, Other Beastmen, two Bull Centaur maximums, the Kroxigor, the Halflings' Ogre, the Grail Knight, the Druchii's Elf, the Wolfman, the Ogre Hunting Party's Ogre, the Gnoblar, the Snotling, the Necrarch Vampire, the Dryad, the Treekin, the Night Haint's Wraith and Spirit, the Fimir, the Brood of Ghurash's Troll and the Khemri Necromancer's Skeleton
                "Item": 449,  # the import's 397 (its 14 animals are beasts'; the PDFs' stubs among them) + one Animal item per beast
                "ItemRule": 53,  # the import's shared rules, the Metal Mongers' Experimental Technology and the Watchmen's Map among them
                "Skill": 447,  # the import's 423 (one per name) + the 24 hired swords' own skills the book lacks
                "SkillGroup": 113,  # the import's 94 + a group of his own for each of 19 hired swords
                "Spell": 293,  # 275 (the PDFs' lores) + the Dark Mage's six (BUG-54)
                # special.json's 24, 3 injury specials, the 57 shared (Fear, No Pain, May Not Run, the mutations of
                # every family, Shornaal's six among them, and the random table's: its Beaked, Fangs and Burning Body
                # are Tchar's and Arkhar's), the templates' 418 (the three Night Goblin and Orc Trolls' one
                # Regeneration (Troll); the Undead's and the Restless Dead's No Pain and May not run shared; the
                # Fighting Ape's Agile (Fighting Ape)) and the hired swords' and personae's own 298 (next step 12;
                # Sigmund's and Veskit's No Pain; each owner's own, none another's of its name: 43 more than when
                # Johann the Knife and Penthesilea held Bertha's Hiring Fee), less the 8 copies of Large Target,
                # Daemonic Flesh, Perfect Killer, Pawnbroker and Hate Orcs and Goblins, shared now (William, 6 Nov);
                # Large Target is Large, which moved from special.json to the shared (William, 6 Nov: "yes same rule");
                # the second PDF batch's five templates add 46 of their own, the third's five 54,
                # the fifth's five 43, the sixth's eight 83, the seventh's seven 52 and the Mousillon batch's six 28 (7 of them the Blood Dragons' bloodline upgrades, less the Killing Blow their Wight holds too) the ninth's four 59 (8 of them the Lothern Sea Patrol's Honours) and the tenth's four 38 (6 of them the Nosferatu's Necrolore upgrades) and the Sealed City's five 35 (3 of them the Silent Brotherhood's modus operandi) and the Khemri batch's seven 36
                # Border Town Burning's Beasts of the East add 31 of their own to special.json (William, 7 Nov 2026)
                # Frenzy, Hate High Elves, Hate Bandits and Outlaws and Hate Spellcasters shared (William, 7 Nov 2026):
                # 4 more, less the Bloodletter's Frenzy, the templates' 6 and the hired swords' and personae's 4; a
                # pointer rule takes the rule it points to (William, 7 Nov 2026), so the Cave Squig holds the Goblin
                # Warriors' Not Orcs and the Pit Fighters' Pit Fighter its skill's one row: 2 fewer; a rule that only
                # named a skill is the skill he starts with (William, 7 Nov 2026: "yes please do that"): the
                # templates' 21, the hired swords' 9 and Maximilian's Strongman fewer; the Corsairs' three Specialist
                # hired swords bring 3 of their own (their Witch Elf's Frenzy is the shared one)
                "Special": 1306,
                # 14 mounts, 10 pets (the Sorcerous Society's four familiars), 39 creatures (17 from MiM, 28 Border
                # Town Burning's Beasts of the East)
                "BestiaryEntry": 63,
                "HiredSword": 75,  # the Dark Elf Corsairs' three Specialists (their Assassin is our Dark Elf Assassin)
                "DramatisPersona": 30,  # mordheimer's, through the catalogue import (next step 12)
                "WarbandTemplate": 114,  # mordheimer's New Warband Format pages (Tileans (old) left out) and the PDFs'
            },
        )
        for model in BOOK_MODELS:
            if hasattr(model, "campaign"):
                with self.subTest(model=model.__name__):
                    self.assertFalse(model.objects.filter(campaign__isnull=False).exists())
            if hasattr(model, "campaign_type"):  # grading phase 1: skills and hired swords get the import's settings
                with self.subTest(model=model.__name__, column="campaign_type"):
                    ungraded = model._default_manager.filter(**{"campaign_type__isnull": True})
                    if model in (HiredSword, DramatisPersona, Item, WarbandTemplate):  # each has its setting
                        self.assertFalse(ungraded.exists())
                    elif model is Skill:  # but the ones a hired sword's seeding makes (his "Hired Sword - …" group)
                        own = {"group_links__group__name__startswith": "Hired Sword - "}
                        self.assertFalse(ungraded.exclude(**own).exists())
                    elif model is Special:  # Mutiny in Marienburg's families' ones the random table lacks, and the
                        # Beasts of the East's own (Border Town Burning)
                        graded = Special.objects.filter(campaign_type__isnull=False)
                        slugs = Counter(graded.values_list("campaign_type__slug", flat=True))
                        # the Bloodletter's Frenzy is the shared one now (William, 7 Nov 2026)
                        self.assertEqual(slugs, {"mutiny-in-marienburg": 10, "border-town-burning": 30})
                    elif model in (Race, Spell, SkillGroup):  # only what the Khemri 3 warbands brought (11 Nov)
                        rest = model._default_manager.filter(**{"campaign_type__isnull": False}).exclude(
                            **{"campaign_type__slug": "khemri-3"}
                        )
                        self.assertFalse(rest.exists())
                    else:  # the rest count as Mordheim's until they get theirs
                        self.assertFalse(model._default_manager.filter(**{"campaign_type__isnull": False}).exists())
        # grading phase 1: the settings, and the warband types and groups, from the catalogue import
        self.assertEqual(CampaignType.objects.count(), 20)
        mordheim = CampaignType.objects.filter(slug__startswith="mordheim").order_by("sort_order")
        names = list(mordheim.values_list("name", flat=True))  # the review (5 Nov 2026: D4): 1a was "Mordheim"
        self.assertEqual(names, ["Mordheim 1a", "Mordheim 1b", "Mordheim 1c", "Mordheim 2a"])
        # William, 11 Nov 2026: Khemri splits by grade too, so its eight grade 3 warbands and everything they
        # bring stay out of a campaign that ticks only its 1b half
        khemri = CampaignType.objects.filter(slug__startswith="khemri").order_by("sort_order")
        self.assertEqual(list(khemri.values_list("name", "grade")), [("Khemri 1b", "1b"), ("Khemri 3", "3")])
        khemri_3 = {
            model.__name__: model.objects.filter(campaign_type__slug="khemri-3").count()
            for model in (
                WarbandType,
                WarbandTemplate,
                Item,
                Skill,
                SkillGroup,
                Race,
                Spell,
                HiredSword,
                DramatisPersona,
            )  # fmt: skip
        }
        # the PDF batch's seven and the Nehekhara Tomb Guards, their four weapons, their skills and the six warband
        # groups plus the Cursed Dwarf Slayer Skills, the Skeleton race and the six Hobgoblin Magic spells; Khemri's
        # own four hired swords and Abdul Alhazred are 1b's
        self.assertEqual(
            khemri_3,
            {
                "WarbandType": 8,
                "WarbandTemplate": 8,
                "Item": 4,
                "Skill": 25,
                "SkillGroup": 7,
                "Race": 1,
                "Spell": 6,
                "HiredSword": 0,
                "DramatisPersona": 0,
            },
        )
        self.assertEqual(WarbandType.objects.filter(campaign__isnull=True).count(), 163)
        # the review (5 Nov 2026: D1): Broheim's typo and its capital "Of" and "The" are put right, the slug kept
        book_types = WarbandType.objects.filter(campaign__isnull=True)
        self.assertEqual(book_types.get(slug="arabyan-theives").name, "Arabyan Thieves")
        self.assertEqual(book_types.get(slug="sons-of-hashut").name, "Sons of Hashut")
        self.assertFalse(book_types.filter(name__regex=r" (Of|The|From) ").exists())
        self.assertEqual(WarbandGroup.objects.count(), 20)

    def test_a_second_run_changes_no_book_row_but_rewrites_every_availability(self):
        items = set(Item.objects.values_list("id", "name", "type"))
        availabilities = set(ItemAvailability.objects.values_list("id", flat=True))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(re.findall(r"(?i)created:? ([1-9]\d*|skill|special|spell)", output), [])  # nothing new
        self.assertEqual(counts(), self.seeded)
        self.assertEqual(set(Item.objects.values_list("id", "name", "type")), items)
        # every availability is deleted and written again under a new id (CAT-BUG-08's id churn)
        self.assertEqual(set(ItemAvailability.objects.values_list("id", flat=True)) & availabilities, set())

    def test_the_warband_templates_come_in_whole(self):
        # the templates plan, phase 1b: mordheimer's 50 pages with their fighters, lists, rules and upgrades
        self.assertIn("Warband templates import complete. Templates: 114, archived", self.output)
        counts = {model.__name__: model.objects.count() for model in TEMPLATE_ROWS}
        self.assertEqual(
            counts,
            {
                "WarbandTemplateType": 120,  # the snapshot's 57 types but Norse Explorers BTB (waiting for its PDF), the PDFs' one each
                "TemplateFighter": 747,
                "TemplateList": 281,  # mordheimer's 113, the Pit Fighters' four for their three, 6 special and the PDFs' (the Halfling Cook's his own)
                "TemplateListItem": 3130,  # with the Kurgan's two bow lines and the Hung's warhorse (phase 3)
                "TemplateRule": 373,  # 150, the Pit Fighters' style notes, 4 upgrade groups' texts, Poisoned Weapons, the PDFs'
                # 24, less Poisoned Weapons, a warband rule (phase 3), and the tailored lists of the shared mutations: the
                # Cult's other 6, the Court's 3, the Beastmen's 15, the Marauders' 15 and 6 Blessings, Clan Moulder's 9 (Twistkin),
                # the Fen Guard's 7 (Variations), the Lords of the Marsh's 15, the Shallows Beasts' 9, the Underworld
                # Alliance's 8 and the Blood Dragon Vampire's 7 bloodline abilities and the Nosferatu's 6 Necrolore abilities
                "TemplateUpgrade": 140,
            },
        )
        mercenaries = WarbandTemplate.objects.get(slug="mercenaries")
        presets = dict(mercenaries.type_links.values_list("warband_type__slug", "variant"))
        self.assertEqual(presets, {"reiklanders": "reikland", "middenheimers": "middenheim", "marienburgers": "marienburg", "ostermarkers": ""})  # fmt: skip
        swivel = TemplateListItem.objects.get(equipment_list__template__slug="pirates", item__name="Swivel Gun")
        self.assertEqual((swivel.cost, swivel.warband_max), (65, 1))
        # the review (5 Nov 2026: W11): the Wolfcloak is Middenheim's line, not every Mercenary city's
        wolfcloak = TemplateListItem.objects.get(equipment_list__template__slug="mercenaries", item__name="Wolfcloak")
        self.assertEqual(wolfcloak.variant, "middenheim")
        # the review (5 Nov 2026: L8): a link in a rule keeps its words, never its URL ("see Beastmen Raiders")
        for model in (Special, TemplateRule):
            with self.subTest(model=model.__name__):
                self.assertFalse(model.objects.filter(description__contains="https://").exists())
        self.assertTrue(Special.objects.filter(description__contains="(see Beastmen Raiders)").exists())  # a Mark's
        owners = Special.objects.filter(template_fighter_links__isnull=False).values_list("owner_kind", flat=True)
        self.assertEqual(set(owners), {"warband", "general"})  # the templates' own; our Large, Wizard, Priest, shared

    def test_every_owner_links_the_one_shared_special_and_the_rules_kept_apart_stay_theirs(self):
        # William, 5 Nov 2026 (special/shared.py): one Fear, Stupidity, Immune to Psychology and Immune to Poison, and
        # one of each mutation, linked by the templates' fighters and upgrades, the hired swords, personae and beasts
        book = Special.objects.filter(campaign__isnull=True)
        self.assertFalse(book.filter(name__in=("Cause Fear", "Causes Fear", "Fearsome", "Stupid")).exists())
        names = ("Fear", "Stupidity", "Immune to Psychology", "Immune to Poison", "Hideous", "Cloud of Flies")
        links = {
            row.name: (
                row.template_fighter_links.count(),
                row.template_upgrades.count(),
                row.hired_sword_specials.count(),
                row.dramatis_persona_specials.count(),
                row.bestiary_entry_specials.count(),
            )
            for row in book.filter(name__in=names)
        }
        self.assertEqual(
            links,
            {
                "Fear": (
                    91,
                    0,
                    5,
                    5,
                    17,
                ),  # fighters, upgrades, hired swords, dramatis personae, beasts (14 of the East)
                "Stupidity": (9, 0, 0, 0, 2),
                "Immune to Psychology": (55, 0, 1, 2, 0),
                "Immune to Poison": (52, 0, 3, 3, 8),
                "Hideous": (
                    0,
                    7,
                    0,
                    0,
                    0,
                ),  # the Cult's, Blessings, Beastmen's, Marauders' (40 gc), Twistkin's (20), Fimir's, Stromfels'
                "Cloud of Flies": (
                    2,
                    4,
                    0,
                    0,
                    1,
                ),  # the Plague Bearer's and the Nurgling's, the Carnival's, Marauders', Fen Guard's and Underworld Alliance's, the Plaguebearer of the East's
            },
        )
        hideous = TemplateUpgrade.objects.filter(special__name="Hideous").values_list("cost", flat=True)
        self.assertEqual(set(hideous), {40, 20})
        # the review (5 Nov 2026): a Carnival Tainted One read "The mutant causes fear." too
        self.assertEqual(book.get(name="Hideous").description, "The model causes fear.")
        apart = book.filter(name__regex=r"^(Fear|Stupidity|Immune to (Psychology|Poison)) \(")
        kept = dict(apart.values_list("name", "owner_kind"))
        self.assertEqual(
            kept,
            {
                "Fear (Maximilian)": "dramatis_persona",
                "Stupidity (Rat Ogre)": "warband",  # the Skaven's and Clan Pestilens' one row
                "Stupidity (Clan Moulder Rat Ogre)": "warband",  # unless a Clan Moulder Hero is within 6"
                "Stupidity (Cold One Beasthounds)": "warband",
                "Immune to Psychology (Plague Bearers)": "warband",
                "Immune to Psychology (Nurglings)": "warband",  # their own text (the review, 5 Nov 2026: W6)
                "Immune to Psychology (Plague Cart)": "warband",
                "Immune to Psychology (Belandysh)": "dramatis_persona",
                "Immune to Psychology (Ippan Shu)": "dramatis_persona",
                "Immune to Psychology (Nightmare)": "beast",  # a mount's book rule only beasts hold (7 Nov 2026)
                # the daemons', plants' and Terracotta Soldier's of the East: every Leadership-based test passed
                "Immune to Psychology (Beasts of the East)": "beast",
                # the Madbrain passes any Leadership test he takes (Sartosa)
                "Immune to Psychology (Madbrains)": "warband",
                "Immune to Poison (Plague Bearers)": "warband",
                "Immune to Poison (Nurglings)": "warband",
            },
        )
        nurglings = TemplateFighter.objects.get(template__slug="carnival-of-chaos", name="Nurgling")
        texts = nurglings.special_links.filter(special__name__endswith="(Nurglings)").values_list("special__description", flat=True)  # fmt: skip
        self.assertEqual([text.split(" are ")[0] for text in texts], ["Nurglings", "Nurglings"])
        rat_ogres = book.get(name="Stupidity (Rat Ogre)").template_fighter_links.values_list("fighter__template__slug", flat=True)  # fmt: skip
        self.assertEqual(sorted(rat_ogres), ["skaven", "skaven-of-clan-pestilens", "skaven-of-clan-pristekk"])

    def test_frenzy_and_hatred_are_shared_and_a_rule_that_changes_them_stays_its_owners(self):
        # William, 7 Nov 2026: "yes" (Frenzy and Hatred shared as Fear is): one short line each, linking the Rules
        # page's part on it; a Hatred row per target several owners share
        book = Special.objects.filter(campaign__isnull=True, archived_at__isnull=True)
        names = ("Frenzy", "Hate Orcs and Goblins", "Hate High Elves", "Hate Bandits and Outlaws", "Hate Spellcasters")
        links = {
            row.name: (
                row.template_fighter_links.count(),
                row.hired_sword_specials.count(),
                row.dramatis_persona_specials.count(),
                row.bestiary_entry_specials.count(),
            )
            for row in book.filter(name__in=names, type="Psychology")
        }
        self.assertEqual(
            links,
            {
                # Totem Warrior, Berserker, Witch Elf, Cannibal Boy; Sigmund's Maddened; the Bloodletter
                "Frenzy": (6, 1, 1, 1),  # the Corsairs' Witch Elf hired sword takes it too
                "Hate Orcs and Goblins": (5, 3, 0, 0),  # the Dwarf Treasure Hunter's Hates Orcs & Goblins now too
                "Hate High Elves": (0, 1, 1, 0),  # the Dark Elf Assassin's and Dijin Katal's Kindred Hatred
                "Hate Bandits and Outlaws": (2, 0, 0, 0),  # the Horned Hunters' Hang the Bandit!
                "Hate Spellcasters": (2, 0, 0, 0),  # the Witch Hunters' Burn the Witch!
            },
        )
        kept = (
            "Berserkers (Red Toof Goblin)",
            "Kindred Hatred (Strigoi Vampire)",
            "Burn the Witch",
            "Religious Fervour",
        )
        owners = dict(book.filter(name__in=kept).values_list("name", "owner_kind"))
        self.assertEqual(
            owners,
            {
                "Berserkers (Red Toof Goblin)": "warband",  # immune to animosity too
                "Kindred Hatred (Strigoi Vampire)": "warband",  # other vampires, not High Elves
                "Burn the Witch": "hired_sword",  # won't work for a band with a spellcaster
                "Religious Fervour": "dramatis_persona",  # Maximilian must always end his turn closer to the enemy
            },
        )
        pilgrim = book.get(name="Hatred", type="Warband - Bretonnian Chapel Guard")
        self.assertEqual(pilgrim.description, "The model hates every enemy model.")  # open-ended, worded short
        merged = (
            "Berserkers",
            "Maddened",
            "Kindred Hatred",
            "Hang the Bandit!",
            "Burn the Witch!",
            "Hates Orcs & Goblins",
        )
        self.assertFalse(book.filter(name__in=merged).exists())

    def test_a_rule_that_only_named_a_skill_is_the_skill_he_starts_with(self):
        # William, 7 Nov 2026, of the Senior Gunnery Officer's Hunter ("See Shooting Skills."): should he start with
        # the skill itself, as one he'd learned? "yes please do that" (catalogue_import/pointer_rules.py)
        officer = TemplateFighter.objects.get(template__slug="gunnery-school-of-nuln", name="Senior Gunnery Officer")
        hunter = Skill.objects.get(campaign__isnull=True, name="Hunter")
        self.assertEqual([link.skill_id for link in officer.skill_links.all()], [hunter.id])
        self.assertFalse(officer.special_links.filter(special__name="Hunter").exists())
        self.assertFalse(Special.objects.filter(description__istartswith="See Shooting Skills").exists())
        maximilian = DramatisPersona.objects.get(campaign__isnull=True, name="Maximilian the Mad")
        self.assertIn("Strongman", maximilian.skill_links.values_list("skill__name", flat=True))
        self.assertFalse(maximilian.special_links.filter(special__name="Strongman").exists())
        prospector = HiredSword.objects.get(campaign__isnull=True, name="Old Prospector")
        self.assertEqual(
            set(prospector.skill_links.values_list("skill__name", flat=True)), {"Wyrdstone Hunter", "Resilient"}
        )

    def test_a_rule_one_beast_holds_is_named_for_it(self):
        # the review (5 Nov 2026: W7): a book rule typed Animal that one beast holds reads "<rule> (<beast>)" in the
        # Boons & Banes pickers ("Save (Temple Dog)", the Rhinox's rarity rule "Rarity (Rhinox)"); one that several
        # hold keeps its name (Battle Schooled), and so does Animal, every animal's
        animal = Special.objects.filter(campaign__isnull=True, type="Animal", archived_at__isnull=True)
        self.assertEqual({row.name for row in animal if not row.name.endswith(")")}, {"Animal", "Battle Schooled"})

        def rules(beast: str) -> set[str]:
            entry = BestiaryEntry.objects.get(name=beast)
            return set(entry.bestiary_entry_specials.values_list("special__name", flat=True))

        temple_dog = {"Fear", "Save (Temple Dog)", "Ferocious Charge (Temple Dog)", "Magical attacks (Temple Dog)"}
        self.assertEqual(rules("Temple Dog"), temple_dog | {"Immune to Poison"})
        self.assertEqual(rules("War Boar"), {"Ferocious Charge (War Boar)", "Thick Skinned (War Boar)"})
        self.assertEqual(rules("Rhinox"), {"Rarity (Rhinox)", "Fear", "Bad Tempered (Rhinox)", "Thunderous Charge (Rhinox)"})  # fmt: skip
        self.assertEqual(rules("Cold One"), {"Fear", "Stupidity", "Scaly (Cold One)"})
        self.assertEqual(rules("Gnoblar Fighter"), {"Weapons/Armour (Gnoblar)", "Largely Insignificant (Gnoblar)", "Bicker (Gnoblar)"})  # fmt: skip
        charge = Special.objects.get(campaign__isnull=True, name="Ferocious Charge (Temple Dog)").description
        self.assertIn("+1 Strength", charge)  # the Temple Dog's own, not the boar's +2S
        # only beasts hold them: off Boons & Banes (William, 7 Nov 2026: "keep bestiary rules from displaying on the
        # boons and banes page"); the shared ones they hold stay general
        kinds = dict(animal.values_list("name", "owner_kind"))
        self.assertEqual({kinds["Save (Temple Dog)"], kinds["Animal"], kinds["Battle Schooled"]}, {"beast"})
        self.assertEqual(Special.objects.get(campaign__isnull=True, name="Fear").owner_kind, "general")

    def test_border_town_burning_brings_its_beasts_of_the_east(self):
        # William, 7 Nov 2026: "add more to bestiary" (mordheimer's Beasts of the East, read 7 Nov 2026): 28 creatures
        # met in battle, never sold, each its profile as printed, the shared rules linked, its own rules ours
        book = BestiaryEntry.objects.filter(campaign__isnull=True)
        beasts = book.filter(animal_item__campaign_type__slug="border-town-burning")
        self.assertEqual(beasts.count(), 28)
        self.assertEqual(
            set(beasts.values_list("kind", "available_in_shop", "has_profile")), {("creature", False, True)}
        )
        self.assertEqual(book.filter(name__in=("Bear", "Bear (Border Town Burning)")).count(), 2)  # MiM's is its own

        def rules(beast: str) -> set[str]:
            return set(beasts.get(name=beast).bestiary_entry_specials.values_list("special__name", flat=True))

        ogre = beasts.get(name="Dragon Ogre")
        profile = [getattr(ogre, field) for field in STAT_FIELDS]
        self.assertEqual((profile, ogre.large), ([7, 4, 2, 5, 4, 4, 2, 3, 8], True))
        self.assertEqual(
            rules("Dragon Ogre"), {"Fear", "Large", "Scaly Skin (Dragon Ogre)", "Storm Rage (Dragon Ogre)"}
        )
        kit = ogre.bestiary_entry_items.values_list("item__name", "quantity")
        self.assertEqual(list(kit), [("Double-handed weapon", 1)])
        daemonic = {"Fear", "Immune to Poison", "Immune to Psychology (Beasts of the East)", "Daemonic Aura (Beasts of the East)"}  # fmt: skip
        self.assertEqual(rules("Plaguebearer"), daemonic | {"Cloud of Flies"})  # the Blessing of Nurgle, the same rule
        self.assertEqual(rules("Hydra"), {"Fear", "Loss of Heads (Hydra)", "Regeneration (Hydra)", "No Pain", "Gigantic Monster (Beasts of the East)"})  # fmt: skip
        written = {name: beasts.get(name=name).written_stats for name in ("Hydra", "Giant", "Man-eating Oak")}
        self.assertEqual(
            written,
            {
                "Hydra": {"attacks": "*"},
                "Giant": {"attacks": "special"},
                "Man-eating Oak": {"movement": "-", "ballistic_skill": "-", "leadership": "-"},
            },
        )
        champion = beasts.get(name="Champion of Chaos").bestiary_entry_skills.values_list("skill__name", flat=True)
        self.assertEqual(set(champion), {"Step Aside", "Mighty Blow", "Resilient", "Sweeping blow"})
        own = Special.objects.filter(campaign__isnull=True, bestiary_entry_specials__bestiary_entry__in=beasts, type="Animal")  # fmt: skip
        self.assertEqual(set(own.exclude(name="Animal").values_list("campaign_type__slug", flat=True)), {"border-town-burning"})  # fmt: skip

    def test_the_lizardmens_oversized_jaws_and_poison_glands_are_body(self):
        # William, 5 Nov 2026: two of the Sacred markings are bodily (data/special-categories.json), not auras
        markings = Special.objects.filter(template_upgrades__group="Sacred markings").values_list("name", "category")
        self.assertEqual(
            dict(markings), {"Oversized Jaws": "body", "Poison Glands": "body", "Mark of the Old Ones": "aura"}
        )

    def test_skaven_and_clan_pestilens_keep_their_own_maximums(self):
        # the 2026-10-28 data audit: races.json held Clan Pestilens' maximums under the name "Skaven" too, and
        # seed_races upserts by name, so the Skaven race had M5 T5 instead of M6 T4
        self.assertIn("Races import complete. Created: 47, Updated: 0", self.output)
        skaven = {race.name: (race.movement, race.toughness) for race in Race.objects.filter(name__startswith="Skaven")}
        self.assertEqual(skaven, {"Skaven": (6, 4), "Skaven (Clan Pestilens)": (5, 5)})

    def test_the_carnivals_brute_and_tainted_one_are_human_and_the_kroxigor_a_kroxigor(self):
        # the review (5 Nov 2026: W10): mordheimer's "mutant" Brute and Tainted One came in raceless, and so did the
        # Kroxigor ("race": "kroxigor", among the creatures), so a hire of one inherited no race maximum
        fighters = TemplateFighter.objects.filter(
            template__slug__in=("carnival-of-chaos", "lizardmen"), name__in=("Brute", "Tainted One", "Kroxigor")
        )
        races = dict(fighters.values_list("name", "race__name"))
        self.assertEqual(races, {"Brute": "Human", "Tainted One": "Human", "Kroxigor": "Kroxigor"})
        kroxigor = Race.objects.get(name="Kroxigor")  # his profile: he never gains experience
        self.assertEqual((kroxigor.movement, kroxigor.strength, kroxigor.toughness, kroxigor.wounds), (6, 5, 4, 3))

    def test_the_dramatis_personae_are_named_in_one_casing(self):
        # the review (5 Nov 2026: D2): "Aenur, the sword of twilight", "Crow Master, The" and "Drenok Johansen,
        # Wielder Of The Great Axe" (overrides.json persona_names); their own rules' types follow their names
        names = set(DramatisPersona.objects.values_list("name", flat=True))
        wanted = {"Aenur, the Sword of Twilight", "The Crow Master", "Drenok Johansen, Wielder of the Great Axe"}
        self.assertLessEqual(wanted, names)
        self.assertEqual({name for name in names if re.search(r" (Of|The|In|From)\b|, The |­", name)}, set())
        self.assertFalse(Special.objects.filter(type__startswith="Dramatis Persona - Crow Master").exists())
        maximilian = DramatisPersona.objects.get(name="Maximilian the Mad")
        self.assertTrue(maximilian.special_links.filter(special__name="Fear (Maximilian)").exists())  # still his own

    def test_a_race_is_named_in_the_singular(self):
        # the review (5 Nov 2026: D10): "Skinks" and "Centigors" beside Human and Saurus; Other Beastmen stays (the plan)
        self.assertFalse(Race.objects.filter(name__in=("Skinks", "Centigors")).exists())
        lizardmen = TemplateFighter.objects.filter(template__slug="lizardmen", name__startswith="Skink")
        self.assertEqual(set(lizardmen.values_list("race__name", flat=True)), {"Skink"})
        self.assertEqual(HiredSword.objects.values_list("race__name", flat=True).get(name="Chaos Centaur"), "Centigor")

    def test_both_pirates_lists_keep_their_own_sea_legs(self):
        # the 2026-10-28 data audit: skills.json held a second Pirates list (sourced "TBMF") under the same type; since
        # the skill groups (phase 1a) its Sea Legs is its own skill, "Sea Legs (TBMF)" (William agreed the split), and
        # the two lists are two groups sharing Cutlass Master and Swashbuckler
        self.assertIn("Skills import complete. Created: 423, Updated: 0", self.output)
        self.assertIn("If he Falls during a battle", Skill.objects.get(name="Sea Legs").description)
        self.assertIn("swings through rope and rigging", Skill.objects.get(name="Sea Legs (TBMF)").description)
        second = SkillGroup.objects.get(name="Pirates (TBMF)").skill_links.values_list("skill__name", flat=True)
        self.assertEqual(
            set(second), {"Captain Blood", "Sea Legs (TBMF)", "Cutlass Master", "Treasure Hunter", "Swashbuckler"}
        )
        first = set(SkillGroup.objects.get(name="Pirates").skill_links.values_list("skill__name", flat=True))
        self.assertIn("Sea Legs", first)
        self.assertNotIn("Sea Legs (TBMF)", first)

    def test_knives_carry_their_save_modifier_and_two_handed_is_one_shared_rule(self):
        # the 2026-10-28 data audit against mordheimer, kept by the import: the knives carry "+1 Enemy armour save",
        # and "Two Handed" and "Two-handed" are one shared rule
        def holders(name: str) -> set[str]:
            items = Item.objects.filter(campaign__isnull=True, rule_links__rule__name=name)
            return set(items.values_list("name", flat=True))

        knives = {"Dagger", "Disease Dagger", "Fist", "Hobgoblin Poisoned Daggers", "Kitchen Knife", "Main Gauche"}
        knives |= {"Misericordia", "Poison Daggers", "Shortsword", "Spirit Knife", "Starblade", "Thinglash"}
        self.assertEqual(holders("+1 Enemy armour save"), knives)
        self.assertEqual(ItemRule.objects.filter(name__iregex=r"^two.handed$").count(), 1)
        self.assertLessEqual({"Boat Hook", "Brazier Iron", "Pike (Merchant Caravans)", "Flail", "Halberd"}, holders("Two-handed"))  # fmt: skip

    def test_item_values_match_mordheimer(self):
        # the 2026-10-28 data audit: transcription errors in a price, a save and a strength
        helmet = Item.objects.get(campaign__isnull=True, name="Cooking Pot Helmet")
        self.assertEqual(list(helmet.availabilities.values_list("cost", flat=True)), [8])
        self.assertEqual(Item.objects.get(campaign__isnull=True, name="Mechanical Suit").save_value, "4+")
        self.assertEqual(Item.objects.get(campaign__isnull=True, name="Fighting Claws").strength, "As user")

    def test_the_seeded_bounty_hunter_detail_costs_9_queries(self):
        # PERF-46, CAT-TEST-08 (was pinned: 43 and 45, each of his 8 items read on its own; flipped in PR A)
        client = APIClient()
        client.force_authenticate(user=get_user_model().objects.create_user(username="reader@example.com"))
        hunter = HiredSword.objects.get(name="Bounty Hunter", campaign__isnull=True)
        with CaptureQueriesContext(connection) as captured:
            self.assertEqual(client.get(f"/api/hired-swords/{hunter.id}/").status_code, 200)
        self.assertEqual(len(captured), 9)  # constant whatever the equipment

    def test_every_seeded_link_resolves(self):
        # BUG-54, CAT-TEST-13 (was pinned: 16 links unresolved; flipped in PR A: prefixes stripped, apostrophes
        # straightened, aliases added, Animal items cached as they are written; the Giant Spider's S0, set aside by
        # decision 8, is checked in the next test)
        self.assertEqual(self.unresolved(self.output), [])
        links = {
            ("Highwayman", "Riding/Draft Horse"),
            ("Roadwarden", "Riding/Draft Horse"),
            ("Freelancer", "Warhorse"),
            ("Hobgoblin Scout", "Giant Wolf"),
            ("Priest of Morr", "Double-handed weapon"),
        }
        equipped = set(HiredSwordItem.objects.values_list("hired_sword__name", "item__name"))
        self.assertLessEqual(links, equipped)
        ninja = set(HiredSwordSkill.objects.filter(hired_sword__name="Ninja").values_list("skill__name", flat=True))
        self.assertLessEqual({"Leap", "Lightning Reflexes"}, ninja)
        knight = HiredSwordSkill.objects.filter(hired_sword__name="Knight of the White Wolf").values_list("skill__name", flat=True)  # fmt: skip
        self.assertIn("Ride [Animal]", knight)

    def test_no_seeded_profile_attacks_with_strength_0(self):
        # BUG-54's last part, CAT-TEST-13: the Giant Spider was seeded with S0; mordheimer gives "3(4)", S3 with its
        # Poisoned Attack counting as S4
        for model in (BestiaryEntry, HiredSword):
            with self.subTest(model=model.__name__):
                self.assertFalse(model.objects.filter(strength=0, attacks__gt=0).exists())
        self.assertEqual(BestiaryEntry.objects.get(name="Giant Spider").strength, 3)

    def test_hired_swords_take_mordheimers_initiative_skill_lists_and_races(self):
        # the 2026-10-28 data audit: the Norse Shaman had I3, the Human Scout lacked Shooting and the Mule Skinner
        # Academic, and nine race labels matched no book race; five of them name one under mordheimer's race, and
        # two more take the book race that fits (a Chaos Centaur is a Centigor-sized centaur, and the bestiary says
        # "Gnoblars count as Greenskins"); the Bone Goliath (undead construct) takes Undead, the race the warband
        # templates brought in (a Human's maximum), and the Chaos Fury (daemon) has none
        shaman, scout, skinner = (HiredSword.objects.get(name=name) for name in ("Norse Shaman", "Human Scout", "Mule Skinner"))  # fmt: skip
        self.assertEqual(shaman.initiative, 4)
        self.assertLessEqual({"Combat", "Shooting", "Speed"}, set(scout.available_skill_types))
        self.assertLessEqual({"Combat", "Academic", "Strength"}, set(skinner.available_skill_types))
        races = dict(HiredSword.objects.values_list("name", "race__name"))
        self.assertEqual({name for name, race in races.items() if race is None}, {"Chaos Fury"})
        mapped = {"Chameleon Skink": "Skink", "Dark Elf Assassin": "Elf", "Shadow Warrior": "Elf"}
        mapped |= {"Wood Elf Hunter": "Elf", "Ungor Trapper": "Ungor"}
        mapped |= {"Chaos Centaur": "Centigor", "Ninja Gnoblar": "Goblin", "Bone Goliath": "Undead"}
        self.assertEqual({name: races[name] for name in mapped}, mapped)

    def test_the_ogre_keeps_both_swords_and_the_fees_are_structured(self):
        # the bestiary rewrite: the browser's hire copy dropped quantities and formulas; the catalogue keeps them
        ogre = HiredSword.objects.get(name="Ogre Bodyguard")
        ninja = HiredSword.objects.get(name="Ninja")
        rat_ogre = HiredSword.objects.get(name="Clan Skryre Rat Ogre")

        self.assertIn(("Sword", 2), set(ogre.item_links.values_list("item__name", "quantity")))
        # the fees and skill lists step: the fees are mordheimer's, read as kind, gold, dice and resources
        self.assertEqual(ninja.hire_fee, make_fee(gold=70, dice=3))
        self.assertEqual(ninja.upkeep_fee, make_fee("none"))
        self.assertEqual(rat_ogre.upkeep_fee, make_fee(resources=[("Wyrdstone", 1)]))
        priest = HiredSword.objects.get(name="Priest of Morr")
        self.assertEqual((priest.hire_fee["kind"], priest.upkeep_fee["kind"]), ("replaces_hero", "none"))
        belandysh = DramatisPersona.objects.get(name__startswith="Belandysh")
        self.assertEqual(belandysh.hire_fee, make_fee(gold=90, resources=[("Campaign points", 5)]))
        bertha = DramatisPersona.objects.get(name__startswith="Bertha")
        self.assertEqual(bertha.hire_fee["kind"], "special")
        sigmund = DramatisPersona.objects.get(name__startswith="Sigmund")
        self.assertEqual((sigmund.hire_fee["gold"], sigmund.upkeep_fee), (70, make_fee(gold=35)))
        self.assertIn("one body part", sigmund.hire_fee["note"])
        self.assertEqual(HiredSword.objects.get(name="Halfling Thief").upkeep_fee, make_fee(gold=15, note="15 gc*"))
        self.assertEqual((ogre.race.name if ogre.race else None, ogre.race_label), ("Ogre", "Ogre"))

    def test_who_may_hire_and_learn_comes_from_the_import(self):
        # the items rebuild: every hired sword names who may hire him (mordheimer's lists); since the skill groups
        # (phase 1a) the core groups are for everyone and a warband's group names its warbands
        self.assertFalse(HiredSword.objects.filter(for_everyone=True).exists())
        self.assertFalse(HiredSword.objects.filter(warband_links__isnull=True).exists())
        self.assertTrue(SkillGroup.objects.get(name="Speed").for_everyone)
        skaven = SkillGroup.objects.get(name="Skaven")
        self.assertFalse(skaven.for_everyone)
        self.assertTrue(skaven.warband_links.exists())
        self.assertIn("Tail Fighting", skaven.skill_links.values_list("skill__name", flat=True))
        # William, 6 Nov 2026: "the MiM group is called militant mootlanders and should have their own skills"
        moot = SkillGroup.objects.get(name="Militant Mootlanders")
        learners = list(moot.warband_links.values_list("warband_type__slug", "warband_type__name", "warband_group"))
        self.assertEqual(learners, [("militiant-mootlanders", "Militant Mootlanders", None)])  # the slug the source's
        self.assertIn("Tea-leaf", moot.skill_links.values_list("skill__name", flat=True))
        self.assertFalse(SkillGroup.objects.filter(name="Halflings").exists())  # the 2a Halflings learn none of it

    def test_williams_skill_list_decisions_are_seeded(self):
        # the fees and skill lists step: the import's skills with his decisions, each list's decision now its group's
        def group(name: str) -> SkillGroup:
            return SkillGroup.objects.get(name=name, campaign__isnull=True)

        def learners(name: str) -> set[str]:
            return set(group(name).warband_links.values_list("warband_type__slug", flat=True))

        def holds(name: str) -> set[str]:
            return set(group(name).skill_links.values_list("skill__name", flat=True))

        large = group("Large Special")
        self.assertEqual((len(holds("Large Special")), large.large_only, large.for_everyone), (5, True, True))
        self.assertEqual(list(SkillGroup.objects.filter(large_only=True)), [large])
        vampires = group("Undead Vampires")
        self.assertEqual((vampires.learn_note, vampires.for_everyone, learners("Undead Vampires")), ("Vampire only", False, {"undead"}))  # fmt: skip
        self.assertIn("Mist Form", holds("Undead Vampires"))
        self.assertEqual(learners("Skaven Metal Mongers"), {"metal-mongers"})
        self.assertEqual(learners("Pirates (TBMF)"), {"pirates"})
        self.assertTrue(group("Animal").for_everyone)
        self.assertIn("Falconer", holds("Animal"))
        inventor = Skill.objects.get(name="Master Inventor")
        self.assertEqual(learners("Dwarf Exiled Engineers"), {"guild-of-disgraced-engineers"})
        self.assertIn("Master Inventor", holds("Dwarf Exiled Engineers"))
        self.assertEqual(inventor.campaign_type.slug if inventor.campaign_type else None, "mutiny-in-marienburg")
        self.assertIn("D3+1 inventions", inventor.description)
        self.assertNotIn("Master Inventor", Skill.objects.get(name="Quick Thinker").description)
        gone = ("Skills list prohibitions", "New Skill")
        self.assertFalse(Skill.objects.filter(name__in=gone).exists())
        # mordheimer's Strigany list stays out (no Strigany type); the Channel Rats' PDF, the River Strigany, brings
        # their skills as the Channel Rats' group, Songster one skill with the Slayer Cult's
        strigany = {"Prize-fighter", "Knowledge of Myths and Legends", "Animal Charmer", "Songster", "Bull Rush"}
        self.assertLessEqual(strigany, holds("Channel Rats"))
        self.assertEqual(learners("Channel Rats"), {"channel-rats"})
        self.assertEqual(Skill.objects.filter(name__startswith="Animal Charmer").count(), 1)

    def test_skill_groups_merge_split_and_add_as_william_agreed(self):
        # the skill groups (phase 1a): a name in several lists is one skill in each list's group, six stay two skills,
        # and nine groups are new, each its warband type's alone
        infiltration = Skill.objects.get(name="Infiltration")
        held_by = set(infiltration.group_links.values_list("group__name", flat=True))
        self.assertEqual(held_by, {"Dark Elf", "Sea Ghosts", "Skaven", "Skaven Metal Mongers", "Horned Hunters", "Night Goblins (MIC)", "Druchii", "Ogre Hunting Party", "Wood Elves of Athel Loren", "Wood Elves of Arden", "Channel Rats", "Underworld Alliance", "Dark Elf Corsairs", "Woodsmen de Artois", "Lothern Sea Patrol", "Silent Brotherhood", "Arabyan Theives"})  # fmt: skip
        self.assertTrue(infiltration.description.startswith("A warrior with this skill is always placed"))
        self.assertEqual(set(Skill.objects.get(name="Infiltration (Skink)").group_links.values_list("group__name", flat=True)), {"Skink"})  # fmt: skip
        self.assertTrue(Skill.objects.filter(name="Battle Tongue").exists())
        self.assertFalse(Skill.objects.filter(name="Battle tongue").exists())
        cavalcade = SkillGroup.objects.get(name="Cursed Cavalcade")
        self.assertEqual(set(cavalcade.skill_links.values_list("skill__name", flat=True)), {"Noblesse Obliges", "Torturer", "Duelist"})  # fmt: skip
        self.assertEqual(list(cavalcade.warband_links.values_list("warband_type__slug", flat=True)), ["cursed-cavalcade"])  # fmt: skip
        self.assertFalse(cavalcade.for_everyone)
        dwarves = SkillGroup.objects.get(name="Dwarves").warband_links.values_list("warband_type__slug", flat=True)
        self.assertEqual(
            list(dwarves), ["dwarf-treasure-hunters"]
        )  # skill_group_learners: the warband it is named after
        sea_ghosts = SkillGroup.objects.get(name="Sea Ghosts").warband_links.values_list(
            "warband_type__slug", flat=True
        )
        self.assertEqual(list(sea_ghosts), ["sea-ghosts"])
        self.assertFalse(SkillGroup.objects.filter(name="Strigany").exists())  # no Strigany warband type
        hunters = SkillGroup.objects.get(name="Horned Hunters").skill_links.values_list("skill__name", flat=True)
        self.assertIn("Pathfinder (Horned Hunters)", hunters)  # the hired sword's Pathfinder keeps the bare name
        amazons = SkillGroup.objects.get(name="Amazons").warband_links.values_list("warband_group__slug", flat=True)
        self.assertEqual(list(amazons), ["amazons"])  # both Amazons types, stored as their group

    def test_the_dark_mage_knows_his_six_spells(self):
        # BUG-54, CAT-TEST-13: the "1 - " to "6 - " prefixes kept his spells from matching; they are his own spells,
        # written as book spells with the roll from the prefix and the difficulty from the text, in the lore his rules
        # name them by, Dark Magic (the review, 5 Nov 2026: D3; they were "Hired Sword - Dark Mage")
        spells = Spell.objects.filter(hired_sword_spells__hired_sword__name="Dark Mage").order_by("roll")

        self.assertEqual(
            [(spell.roll, spell.name, spell.dc, spell.type) for spell in spells],
            [
                (1, "Banishment", "8", "Dark Magic"),
                (2, "Soul Render", "8", "Dark Magic"),
                (3, "Shade Mount", "8", "Dark Magic"),
                (4, "Jozun's Decay", "9", "Dark Magic"),
                (5, "Cowel of Pain", "6", "Dark Magic"),
                (6, "Doom & Dark", "7", "Dark Magic"),
            ],
        )

    def _campaign_with_an_axe_and_half_price_armour(self) -> tuple[Campaign, Item]:
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        axe = Item.objects.create(name="Axe", type="Weapon", subtype="Melee", campaign=campaign)
        ItemAvailability.objects.create(item=axe, cost=25)
        sync_half_price_armour_for_campaign(campaign.id)
        return campaign, axe

    def test_reseeding_with_a_campaign_axe_and_half_price_armour_leaves_the_campaign_rows_alone(self):
        # BUG-17, CAT-TEST-12: the second run must update the book, keep the campaign's rows and add no duplicates
        campaign, axe = self._campaign_with_an_axe_and_half_price_armour()
        campaign_rows = set(Item.objects.filter(campaign=campaign).values_list("id", "name"))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(Item.objects.filter(campaign__isnull=True).count(), self.seeded["Item"])
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "name")), campaign_rows)
        self.assertEqual(axe.availabilities.get().cost, 25)

    def test_a_reseed_rewrites_the_book_axe_beside_a_same_named_campaign_axe(self):
        # BUG-17 (was pinned: the Axe, the first item in standard-items.json, matched the book Axe and the campaign's,
        # so seed_items stopped before writing any item; flipped in PR A)
        campaign, axe = self._campaign_with_an_axe_and_half_price_armour()
        Item.objects.filter(campaign__isnull=True, name="Axe").update(flavour="stale")

        seed_all()

        self.assertNotEqual(Item.objects.get(name="Axe", campaign__isnull=True).flavour, "stale")
        self.assertEqual(Item.objects.get(id=axe.id).campaign_id, campaign.id)

    def test_a_reseed_rewrites_every_book_armour_and_leaves_the_clones(self):
        # BUG-17 (was pinned: every clone shared its book armour's name and type, so seed_items crashed on the first
        # armour with the items before it already rewritten; flipped in PR A: the book only, and atomic)
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        sync_half_price_armour_for_campaign(campaign.id)
        clones = set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id"))
        Item.objects.filter(campaign__isnull=True, name__in=["Axe", "Wyrdstone Pendulum"]).update(flavour="stale")

        seed_all()

        self.assertNotEqual(Item.objects.get(name="Axe").flavour, "stale")
        self.assertNotEqual(Item.objects.get(name="Wyrdstone Pendulum").flavour, "stale")
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id")), clones)

    def test_a_reseed_leaves_the_campaigns_versions_alone_and_a_rule_still_skips_a_hand_made_one(self):
        # CAT-TEST-12 with PR C's versions: a reseed rewrites the book and resyncs the half-price rule; the versions
        # keep their ids, books and prices, and the hand-made Heavy Armour version stays out of the rule
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        CampaignHouseRule.objects.create(campaign=campaign, title="Half price", effect_key="half_price_armour")
        book_axe = Item.objects.get(campaign__isnull=True, name="Axe")
        heavy = Item.objects.get(campaign__isnull=True, name="Heavy Armour")
        axe = Item.objects.create(name="Axe", type=book_axe.type, campaign=campaign, replaces=book_axe)
        ItemAvailability.objects.create(item=axe, cost=25)
        mine = Item.objects.create(name="Heavy Armour", type=heavy.type, subtype=heavy.subtype, campaign=campaign, replaces=heavy)  # fmt: skip
        sync_half_price_armour_for_campaign(campaign.id)
        versions = set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id", "generated_effect_key"))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "replaces_id", "generated_effect_key")), versions)  # fmt: skip
        self.assertEqual(Item.objects.filter(replaces=heavy, campaign=campaign).get().id, mine.id)
        self.assertEqual(axe.availabilities.get().cost, 25)
