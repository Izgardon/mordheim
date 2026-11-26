"""The hireling catalogue's payloads: `GET /api/hired-swords/` and `/api/dramatis-personae/` (the bestiary rewrite
step 2).

A list row is the entry with its race (the catalogue's and the source's text) and who may hire it; a detail adds its
skills, specials, spells and equipment with quantities. A dramatis persona adds `stays` and `payment_note`. Every
row ends with the catalogue's badge fields. Both kinds cost the same queries whatever the number of rows or the
kit's size.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.catalogue.payloads import BADGES
from apps.hirelings.models import MAX_KIT_QUANTITY, HiredSword
from apps.items.tests.catalogue_support import DRAMATIS_PERSONAE, HIRED_SWORDS, ITEMS, CatalogueTestCase, make_entry
from apps.warbands.models import WarbandType

STATS = [
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
]
ROW = [
    "id",
    "campaign_id",
    "setting_id",
    "name",
    "description",
    *STATS,
    "written_stats",  # a written stat's text by field ("D6")
    "armour_save",
    "large",
    "caster",
    "race_id",
    "race_name",
    "race_label",
    "hire_fee",
    "upkeep_fee",
    "rating",
    "available_skill_types",
    "grade",
    "for_everyone",
    "hire_note",
]
KIT = ["skills", "specials", "spells", "equipment"]


class HirelingPayloadTests(CatalogueTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.ogre.warband_links.create(warband_type=self.mercenaries)
        self.ogre.skill_links.create(skill=self.infiltration[0])
        self.ogre.special_links.create(special=self.large)
        self.ogre.spell_links.create(spell=self.lifestealer[0])
        self.ogre.item_links.create(item=self.book_sword, quantity=2)
        self.aenur.item_links.create(item=self.book_axe)
        self.ogre.race = self.human
        self.ogre.race_label = "Ogre"
        self.ogre.save(update_fields=["race", "race_label"])

    def get(self, url: str) -> Any:
        response = self.get_as(self.player, url)
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_a_hired_sword_row_and_detail(self):
        WarbandType.objects.filter(pk=self.mercenaries.pk).update(source_code="MHR")  # tells two of one name apart
        [row] = [row for row in self.get(HIRED_SWORDS.list_url(self.campaign)) if row["id"] == self.ogre.id]
        detail = self.get(HIRED_SWORDS.detail_url(self.ogre.id))

        self.assertEqual(list(row), [*ROW, "warbands", *BADGES])
        self.assertEqual(list(detail), [*ROW, "warbands", *KIT, *BADGES])
        self.assertEqual((row["race_id"], row["race_name"], row["race_label"]), (self.human.id, "Human", "Ogre"))
        line = {"warband_type_id": self.mercenaries.id, "warband_group_id": None, "name": "Mercenaries", "source_code": "MHR", "excluded": False}  # fmt: skip
        self.assertEqual((row["for_everyone"], row["warbands"]), (True, [line]))
        self.assertEqual([entry["name"] for entry in detail["skills"]], ["Infiltration (Dark Elf)"])
        self.assertEqual(([entry["name"] for entry in detail["specials"]], [entry["name"] for entry in detail["spells"]]), (["Large"], ["Lifestealer"]))  # fmt: skip
        self.assertEqual([(entry["item"]["name"], entry["quantity"]) for entry in detail["equipment"]], [("Sword", 2)])

    def test_a_dramatis_persona_says_how_long_it_stays_and_what_it_is_paid(self):
        created = self.create_as(self.player, DRAMATIS_PERSONAE, "Bertha", stays="one_battle", payment_note="a favour")
        [row] = [row for row in self.get(DRAMATIS_PERSONAE.list_url(self.campaign)) if row["name"] == "Bertha"]

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(list(created.data), [*ROW, "stays", "payment_note", "warbands", *KIT, *BADGES])
        self.assertEqual(list(row), [*ROW, "stays", "payment_note", "warbands", *BADGES])
        self.assertEqual((row["stays"], row["payment_note"], row["campaign_id"]), ("one_battle", "a favour", self.campaign.id))  # fmt: skip

    def test_a_hired_sword_is_not_a_bestiary_entry(self):
        bestiary = [row["name"] for row in self.get(f"/api/bestiary/?campaign_id={self.campaign.id}")]

        self.assertNotIn("Ogre Bodyguard", bestiary)

    def test_both_lists_and_details_cost_the_same_whatever_the_rows_and_kits(self):
        def counts() -> list[int]:
            found = []
            for url in (
                HIRED_SWORDS.list_url(self.campaign),
                DRAMATIS_PERSONAE.list_url(self.campaign),
                HIRED_SWORDS.detail_url(self.ogre.id),
                DRAMATIS_PERSONAE.detail_url(self.aenur.id),
            ):
                with CaptureQueriesContext(connection) as captured:
                    self.get(url)
                found.append(len(captured))
            return found

        before = counts()
        for index in range(3):
            for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
                make_entry(kind, f"More {index}", campaign=self.campaign).warband_links.create(warband_type=self.mercenaries)  # fmt: skip
            item = make_entry(ITEMS, f"Gear {index}")
            self.ogre.item_links.create(item=item)
            self.aenur.item_links.create(item=item)
            self.aenur.skill_links.create(skill=self.infiltration[index + 1])

        self.assertEqual(counts(), before)
        self.assertEqual(before, [3, 3, 9, 9])  # membership, rows, who may hire; a book detail reads no membership


class HirelingWriteBoundsTests(CatalogueTestCase):
    """A kit's quantities and the armour save are bounded as the warband's copies are, so hiring an entry can neither
    flood the warband with item rows nor fail on a save the unit can't hold."""

    def test_a_kit_quantity_over_the_bound_or_a_save_out_of_range_is_refused(self):
        cases: tuple[tuple[dict[str, Any], str], ...] = (
            ({"item_entries": [{"item_id": self.book_sword.id, "quantity": MAX_KIT_QUANTITY + 1}]}, "item_entries"),
            ({"armour_save": 7}, "armour_save"),
            ({"armour_save": -6}, "armour_save"),
        )
        for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
            for number, (body, field) in enumerate(cases):
                with self.subTest(kind=kind.key, field=field, body=body):
                    response = self.create_as(self.owner, kind, f"Bulky {number}", **body)
                    self.assertEqual((response.status_code, list(response.data)), (400, [field]))
        kept = self.create_as(self.owner, HIRED_SWORDS, "Bulky", armour_save=-5, item_entries=[{"item_id": self.book_sword.id, "quantity": MAX_KIT_QUANTITY}])  # fmt: skip
        self.assertEqual((kept.status_code, kept.data["armour_save"]), (201, -5))

    def test_a_stat_may_be_written_as_the_book_prints_it(self):
        for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
            with self.subTest(kind=kind.key):
                created = self.create_as(self.owner, kind, "Wild one", weapon_skill="D6", attacks="1(2)", strength=4)

                self.assertEqual(created.status_code, 201, created.data)
                stats = (created.data["weapon_skill"], created.data["attacks"], created.data["strength"])
                self.assertEqual(stats, (None, 1, 4))
                self.assertEqual(created.data["written_stats"], {"weapon_skill": "D6", "attacks": "(2)"})

    def test_each_box_is_read_as_typed(self):
        # William, 7 Nov 2026: the form sends every box as typed and the server decides
        for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
            with self.subTest(kind=kind.key):
                created = self.create_as(self.owner, kind, "Typed one", strength="4", movement="12", attacks="2(4)")

                self.assertEqual(created.status_code, 201, created.data)
                stats = (created.data["strength"], created.data["movement"], created.data["attacks"])
                self.assertEqual(stats, (4, None, 2))
                self.assertEqual(created.data["written_stats"], {"movement": "12", "attacks": "(4)"})


class KitMaterialWriteTests(CatalogueTestCase):
    """What a kit line holds beside its item survives a write (weapon materials): a save of a book entry through the
    catalogue form used to drop the material and the name its kit gives the item, so editing the Runesmith Journeyman
    turned his gromril hammer into a plain one."""

    def _kit(self, entry: Any) -> list[tuple[int, int, str, str]]:
        rows = entry.item_links.order_by("id")
        return list(rows.values_list("item_id", "quantity", "material", "shown_as"))

    def test_a_create_carries_the_material_and_the_name_its_kit_gives_the_item(self):
        for kind in (HIRED_SWORDS, DRAMATIS_PERSONAE):
            with self.subTest(kind=kind.key):
                line = {"item_id": self.book_sword.id, "quantity": 1, "material": "gromril", "shown_as": "Hammer"}
                created = self.create_as(self.owner, kind, f"Runesmith {kind.key}", item_entries=[line])

                self.assertEqual(created.status_code, 201, created.data)
                entry = kind.model._default_manager.get(pk=created.data["id"])
                self.assertEqual(self._kit(entry), [(self.book_sword.id, 1, "gromril", "Hammer")])
                kit = created.data["equipment"][0]
                self.assertEqual((kit["material"], kit["shown_as"]), ("gromril", "Hammer"))
                self.assertEqual(kit["material_name"], "Gromril Hammer")

    def test_editing_a_book_entry_keeps_what_its_kit_line_is_made_of_and_called(self):
        # the form reads the kit and sends it back: the campaign's version keeps both
        self.ogre.item_links.create(item=self.book_sword, quantity=1, material="gromril", shown_as="Hammer")
        read = self.get_as(self.owner, f"{HIRED_SWORDS.detail_url(self.ogre.id)}?campaign_id={self.campaign.id}")
        sent = [
            {
                "item_id": line["item"]["id"],
                "quantity": line["quantity"],
                "material": line["material"],
                "shown_as": line["shown_as"],
            }
            for line in read.data["equipment"]
        ]

        saved = self.patch_as(
            self.owner,
            HIRED_SWORDS.detail_url(self.ogre.id),
            {"campaign_id": self.campaign.id, "item_entries": sent},
        )

        self.assertEqual(saved.status_code, 200, saved.data)
        version = HiredSword.objects.get(campaign=self.campaign, replaces=self.ogre)
        self.assertEqual(self._kit(version), [(self.book_sword.id, 1, "gromril", "Hammer")])

    def test_a_line_that_says_nothing_is_a_plain_copy_under_its_own_name(self):
        created = self.create_as(self.owner, HIRED_SWORDS, "Plain one", item_entries=[{"item_id": self.book_sword.id}])

        entry = HiredSword.objects.get(pk=created.data["id"])
        self.assertEqual(self._kit(entry), [(self.book_sword.id, 1, "", "")])
        self.assertEqual(created.data["equipment"][0]["material_name"], "Sword")

    def test_an_unknown_material_is_refused(self):
        line = {"item_id": self.book_sword.id, "material": "mithril"}

        response = self.create_as(self.owner, HIRED_SWORDS, "Wrong one", item_entries=[line])

        self.assertEqual((response.status_code, list(response.data)), (400, ["item_entries"]))
