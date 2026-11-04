"""Grading phase 1: the seeders give our skills and hired swords the settings the catalogue import assigns them
(out/setting-assignments.json), Mordheim's where it assigns none."""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.hirelings.models import HiredSword
from apps.skills.models import Skill


class SeededSettingTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        for command in ("seed_settings", "seed_skills", "seed_hired_swords"):
            call_command(command, stdout=StringIO())

    def setting_of(self, model: type[Skill] | type[HiredSword], **lookup: str) -> str:
        row = model.objects.select_related("campaign_type").get(campaign__isnull=True, **lookup)
        return row.campaign_type.slug if row.campaign_type else ""

    def test_hired_swords_take_their_settings_by_name(self) -> None:
        self.assertEqual(self.setting_of(HiredSword, name="Beggar"), "mordheim-2a")
        self.assertEqual(self.setting_of(HiredSword, name="Beast Hunter"), "empire-in-flames")
        self.assertEqual(self.setting_of(HiredSword, name="Dwarf Troll Slayer"), "mordheim")
        self.assertFalse(HiredSword.objects.filter(campaign_type__isnull=True).exists())

    def test_skills_take_theirs_by_name_and_list_and_the_rest_are_mordheims(self) -> None:
        # Hide in Shadows' lists were Mordheim 1b, 1c and the Nemesis Crown's: the one skill takes the lowest
        self.assertEqual(self.setting_of(Skill, name="Hide in Shadows"), "mordheim-1b")
        self.assertEqual(self.setting_of(Skill, name="Sniper"), "nemesis-crown")  # the Hochland Bandits' own
        self.assertEqual(self.setting_of(Skill, name="Sniper (Shadow Warriors)"), "mordheim-1b")
        self.assertEqual(self.setting_of(Skill, name="Tunneler"), "mordheim")  # not on mordheimer
