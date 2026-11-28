"""A preset's settings leave no grade unticked below its highest (William, 28 Nov 2026: Mutiny in Marienburg's 2b
setting on top of the 1c grade preset warned "No 2a setting is ticked, though a 2b one is"; "Tick 2a as well").

The gap is the Settings page's check (frontend `content-in-play.ts: gradeGaps`): a grade below the highest ticked one
that some setting sits at and none ticked does."""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.campaign_presets.models import CampaignPreset
from apps.campaigns.in_play import DEFAULT_PRESET, preset_ids
from apps.campaigns.models import GRADES, CampaignType

# a grade-3 setting skips 2b, which no Mordheim setting fills: which 2b book, if any, is William's call
OPEN_2B = {"khemri", "athel-loren"}


class PresetGradeGapTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        call_command("seed_settings", stdout=StringIO())
        call_command("seed_warband_types", stdout=StringIO())  # the warband rules name their groups and types
        call_command("seed_exploration_charts", stdout=StringIO())
        call_command("seed_campaign_presets", stdout=StringIO())

    def gaps(self, ids: set[int]) -> list[str]:
        """The grades below the highest ticked one that nothing ticked sits at, lowest first."""
        settings = list(CampaignType.objects.all())
        ticked = {setting.grade for setting in settings if setting.pk in ids or setting.always_on}
        held = {setting.grade for setting in settings}
        top = max((GRADES.index(grade) for grade in ticked), default=0)
        return [grade for grade in GRADES[:top] if grade in held and grade not in ticked]

    def test_a_new_campaign_playing_a_preset_ticks_every_grade_below_its_highest(self) -> None:
        presets = list(CampaignPreset.objects.prefetch_related("settings"))
        self.assertEqual(len(presets), 16)
        for preset in presets:
            with self.subTest(preset=preset.slug):
                ticked = {*preset_ids(DEFAULT_PRESET), *(setting.pk for setting in preset.settings.all())}
                self.assertEqual(self.gaps(ticked), ["2b"] if preset.slug in OPEN_2B else [])
