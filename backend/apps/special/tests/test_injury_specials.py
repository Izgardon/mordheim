"""The specials the serious injury tables grant by name are the book's (seed_spells_and_special): general, typed
"Injury", with the book's rule text (the catalogue import's out/serious-injuries.json) and their Boons & Banes kind.
An injury links them, and a hired sword's own rule of the name stays his."""

from io import StringIO

from django.core.management import call_command

from apps.battles.services.injuries import granted_specials, injury_special
from apps.core.book_lookups import BookLookups
from apps.core.seeding import IMPORT_OUT, read_json_list
from apps.special.kinds import BANE, BOON, GENERAL, HIRED_SWORD, INJURY
from apps.special.models import Special
from apps.warbands.tests.roster_support import RosterTestCase


class InjurySpecialSeedingTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.output = StringIO()
        call_command("seed_spells_and_special", stdout=self.output)

    def test_the_tables_specials_are_the_books_with_its_text_and_kind(self):
        # none were seeded: the first roll in a campaign made the campaign a special with no text
        book = {row["name"]: row["text"] for row in read_json_list(IMPORT_OUT / "serious-injuries.json")}
        seeded = Special.objects.filter(campaign=None, type=INJURY).order_by("name")
        self.assertEqual(
            [(row.name, row.kind, row.owner_kind, row.description) for row in seeded],
            [
                ("Hardened", BOON, GENERAL, book["Hardened"]),
                ("Horrible Scars", BOON, GENERAL, book["Horrible Scars"]),
                ("Old Battle Wound", BANE, GENERAL, book["Old Battle Wound"]),
            ],
        )
        self.assertTrue(seeded[0].description.startswith("The warrior survives and becomes inured"))
        self.assertEqual(sorted(granted_specials()), [row.name for row in seeded])
        self.assertIn("Injury specials - Created: 3, Updated: 0.", self.output.getvalue())

    def test_an_injury_links_the_books_special_and_a_second_run_changes_nothing(self):
        hardened = Special.objects.get(campaign=None, name="Hardened", type=INJURY)
        self.assertEqual(injury_special("Hardened", self.campaign.id), hardened)
        again = StringIO()
        call_command("seed_spells_and_special", stdout=again)
        self.assertIn("Injury specials - Created: 0, Updated: 3.", again.getvalue())
        self.assertEqual(Special.objects.filter(type=INJURY).count(), 3)

    def test_a_hired_swords_own_rule_of_the_name_stays_his(self):
        # the hireling seeders run after this one: the Old Prospector would have taken the injury's Hardened
        rule = {"name": "Hardened", "description": "Prospectors are immune to the effects of Fear."}
        own = BookLookups("Hired Sword").special(rule, "Old Prospector")
        assert own is not None
        self.assertEqual(
            (own.type, own.owner_kind, own.description),
            ("Hired Sword - Old Prospector", HIRED_SWORD, rule["description"]),
        )
