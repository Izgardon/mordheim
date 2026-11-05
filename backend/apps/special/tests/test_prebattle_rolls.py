"""Pre-battle rolls (William, 5 Nov 2026): William's list in special/data/prebattle-rolls.json marks the book's
specials, skills and shared item rules with their dice and text, every seeder sets them, and a campaign's rows keep
their own (special/prebattle.py)."""

import json
import tempfile
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from typing import Any
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase

from apps.campaigns.models import Campaign
from apps.items.models import ItemRule
from apps.skills.models import Skill
from apps.special import prebattle
from apps.special.models import Special
from apps.special.prebattle import ITEM_RULE, SKILL, SPECIAL, book_rolls, mark_book_rolls
from apps.warbands.tests.roster_support import RosterTestCase

OLD_BATTLE_WOUND = (
    "The warrior survives, but his wound will prevent him from fighting if you roll a 1 on a D6 at the start of any "
    "battle. Roll at the start of each battle from now on."
)
MODELS: dict[str, Any] = {SPECIAL: Special, SKILL: Skill, ITEM_RULE: ItemRule}


def listed() -> dict[str, dict[str, dict[str, str]]]:
    return dict(json.loads(prebattle.ROLLS_PATH.read_text(encoding="utf-8")))


class WilliamsListTests(SimpleTestCase):
    def tearDown(self) -> None:
        book_rolls.cache_clear()

    def test_old_battle_wound_rolls_a_d6_in_the_books_words(self):
        self.assertEqual(book_rolls()[SPECIAL]["old battle wound"], ("D6", OLD_BATTLE_WOUND))

    def test_every_mark_has_dice_the_dice_entry_reads_and_its_text(self):
        data = listed()
        self.assertEqual(set(data), {SPECIAL, SKILL, ITEM_RULE})
        marks = [mark for kind in data.values() for mark in kind.values()]
        self.assertTrue(marks)
        for mark in marks:
            self.assertIn(mark["roll"], ("D3", "D6", "2D6", "3D6", "D66"))
            self.assertTrue(mark["text"].strip())

    def test_dice_it_cant_read_or_a_mark_without_text_stop_the_seeder(self):
        for mark in ({"roll": "1D6", "text": "Roll."}, {"roll": "D6", "text": " "}):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "prebattle-rolls.json"
                path.write_text(json.dumps({SPECIAL: {"Odd": mark}}), encoding="utf-8")
                book_rolls.cache_clear()
                with mock.patch.object(prebattle, "ROLLS_PATH", path), self.assertRaises(CommandError):
                    book_rolls()


class MarkBookRollsTests(RosterTestCase):
    def test_a_listed_name_is_marked_an_unlisted_one_cleared_and_a_campaigns_rows_kept(self):
        book = Special.objects.create(name="Old Battle Wound", type="Injury")
        stale = Special.objects.create(name="Hardened", type="Injury", prebattle_roll="D6", prebattle_text="Once.")
        version = Special.objects.create(
            campaign=self.campaign, replaces=book, name="Old Battle Wound", type="Injury", prebattle_roll="2D6"
        )
        own = Special.objects.create(campaign=self.campaign, name="Old Battle Wound", type="House rule")

        self.assertEqual(mark_book_rolls(Special, SPECIAL), 2)

        book.refresh_from_db()
        stale.refresh_from_db()
        version.refresh_from_db()
        own.refresh_from_db()
        self.assertEqual((book.prebattle_roll, book.prebattle_text), ("D6", OLD_BATTLE_WOUND))
        self.assertEqual((stale.prebattle_roll, stale.prebattle_text), ("", ""))
        self.assertEqual((version.prebattle_roll, version.prebattle_text), ("2D6", ""))
        self.assertEqual((own.prebattle_roll, own.prebattle_text), ("", ""))
        self.assertEqual(mark_book_rolls(Special, SPECIAL), 0)  # nothing left to change

    def test_a_campaigns_version_sets_changes_or_clears_its_own_roll(self):
        book = Skill.objects.create(name="Spy", description="Re-deploy.", prebattle_roll="D3", prebattle_text="D3.")
        self.client.force_authenticate(user=self.campaign_owner)
        url = f"/api/skills/{book.id}/"
        changed = self.client.patch(
            url, {"campaign_id": self.campaign.id, "prebattle_roll": "D6", "prebattle_text": "D6."}, format="json"
        )
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual((changed.data["prebattle_roll"], changed.data["prebattle_text"]), ("D6", "D6."))
        version = Skill.objects.get(campaign=self.campaign, replaces=book)
        cleared = self.client.patch(
            url, {"campaign_id": self.campaign.id, "prebattle_roll": "", "prebattle_text": ""}, format="json"
        )
        self.assertEqual(cleared.status_code, 200, cleared.data)
        version.refresh_from_db()
        self.assertEqual((version.prebattle_roll, version.prebattle_text), ("", ""))
        wrong = self.client.patch(url, {"campaign_id": self.campaign.id, "prebattle_roll": "D7"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        book.refresh_from_db()
        self.assertEqual((book.prebattle_roll, book.prebattle_text), ("D3", "D3."))

    def test_a_custom_special_and_a_shared_item_rule_take_a_roll(self):
        self.client.force_authenticate(user=self.campaign_owner)
        body = {"campaign_id": self.campaign.id, "prebattle_roll": "D6", "prebattle_text": "On a 1 he hides."}
        special = self.client.post("/api/special/", {**body, "name": "Shy", "type": "House rule"}, format="json")
        rule = self.client.post("/api/item-rules/", {**body, "name": "Cursed"}, format="json")
        for made in (special, rule):
            self.assertEqual(made.status_code, 201, made.data)
            self.assertEqual((made.data["prebattle_roll"], made.data["prebattle_text"]), ("D6", "On a 1 he hides."))


class SeededRollsTests(TestCase):
    """`seed_all` once on an empty database."""

    @classmethod
    def setUpTestData(cls) -> None:
        with redirect_stdout(StringIO()):
            call_command("seed_all")

    def test_seed_all_marks_every_listed_rule_and_nothing_else(self):
        for kind, marks in listed().items():
            model = MODELS[kind]
            marked = model.objects.filter(campaign__isnull=True).exclude(prebattle_roll="")
            self.assertEqual(
                {name.casefold() for name in marked.values_list("name", flat=True)},
                {name.casefold() for name in marks},
                kind,
            )
            for row in marked:
                mark = next(mark for name, mark in marks.items() if name.casefold() == row.name.casefold())
                self.assertEqual((row.prebattle_roll, row.prebattle_text), (mark["roll"], mark["text"]), row.name)
        wound = Special.objects.get(campaign__isnull=True, name="Old Battle Wound", type="Injury")
        self.assertEqual((wound.prebattle_roll, wound.prebattle_text), ("D6", OLD_BATTLE_WOUND))

    def test_every_text_is_the_rules_own_words(self):
        for kind, marks in listed().items():
            for name, mark in marks.items():
                rows = MODELS[kind].objects.filter(campaign__isnull=True, name__iexact=name)
                for row in rows:
                    self.assertIn(mark["text"], getattr(row, "text" if kind == ITEM_RULE else "description"), name)

    def test_a_reseed_leaves_a_campaigns_version_its_own_roll(self):
        wound = Special.objects.get(campaign__isnull=True, name="Old Battle Wound", type="Injury")
        house = Campaign.objects.create(name="House", join_code="HOUSE1")
        version = Special.objects.create(
            campaign=house, replaces=wound, name=wound.name, type=wound.type, prebattle_roll="", prebattle_text=""
        )
        with redirect_stdout(StringIO()):
            call_command("seed_spells_and_special")
        version.refresh_from_db()
        wound.refresh_from_db()
        self.assertEqual((version.prebattle_roll, wound.prebattle_roll), ("", "D6"))
