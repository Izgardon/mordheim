"""Grading phase 1: the settings and their grades, seeded from the catalogue import, the grade presets and the
visibility rule (apps/campaigns/in_play.py)."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.campaigns.in_play import grades_up_to, preset_ids, presets, set_settings, with_in_play
from apps.campaigns.management.commands.seed_settings import seed_settings
from apps.campaigns.models import Campaign, CampaignType
from apps.skills.models import Skill


def seed() -> None:
    call_command("seed_settings", stdout=StringIO())


class SeedSettingsTests(TestCase):
    def test_the_import_seeds_twenty_settings_with_mordheim_always_on(self) -> None:
        seed()
        rows = list(CampaignType.objects.all())
        self.assertEqual(len(rows), 20)
        self.assertEqual(rows[0].slug, "mordheim")
        self.assertEqual((rows[0].grade, rows[0].always_on), ("1a", True))
        self.assertEqual([row.slug for row in rows if row.always_on], ["mordheim"])
        by_slug = {row.slug: row for row in rows}
        self.assertEqual(by_slug["khemri"].grade, "1b")  # Khemri splits by grade too (William, 11 Nov 2026)
        self.assertEqual((by_slug["khemri"].name, by_slug["khemri-3"].grade), ("Khemri 1b", "3"))
        self.assertEqual(by_slug["grade-3"].grade, "3")
        self.assertEqual([row.sort_order for row in rows], list(range(1, 21)))

    def test_seeding_twice_updates_in_place(self) -> None:
        seed()
        CampaignType.objects.filter(slug="lustria").update(name="Old Lustria", grade="3", sort_order=99)
        seed()
        lustria = CampaignType.objects.get(slug="lustria")
        self.assertEqual((lustria.name, lustria.grade, lustria.sort_order), ("Lustria", "1b", 6))
        self.assertEqual(CampaignType.objects.count(), 20)

    def test_a_grade_outside_1a_to_3_stops_the_run(self) -> None:
        with self.assertRaisesMessage(CommandError, "grade '2c'"):
            seed_settings([{"slug": "odd", "name": "Odd", "grade": "2c"}])


class PresetTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        seed()

    def slugs(self, ids: list[int]) -> list[str]:
        return list(CampaignType.objects.filter(id__in=ids).values_list("slug", flat=True))

    def test_a_preset_ticks_every_setting_at_or_below_its_grade(self) -> None:
        self.assertEqual(grades_up_to("1c"), ("1a", "1b", "1c"))
        self.assertEqual(self.slugs(preset_ids("1a")), ["mordheim", "empire-in-flames"])
        up_to_1c = self.slugs(preset_ids("1c"))
        self.assertEqual(
            up_to_1c,
            [
                "mordheim",
                "mordheim-1b",
                "mordheim-1c",
                "empire-in-flames",
                "lustria",
                "khemri",
                "nemesis-crown",
                "border-town-burning",
            ],
        )
        self.assertEqual(len(preset_ids("3")), 20)

    def test_presets_list_each_grade_lowest_first_with_its_settings(self) -> None:
        listed = presets(CampaignType.objects.all())
        self.assertEqual(
            [row["label"] for row in listed], ["Up to 1a", "Up to 1b", "Up to 1c", "Up to 2a", "Up to 2b", "Up to 3"]
        )
        self.assertEqual(listed[2]["setting_ids"], preset_ids("1c"))
        self.assertEqual(listed[2]["description"], "Experimental")


class VisibilityRuleTests(TestCase):
    """An entry is in play when its setting is ticked or always on, or when it has none (custom, or Mordheim's by
    default); anything else is listed with in_play false, never hidden."""

    campaign: Campaign
    other: Campaign
    rows: dict[str, Skill]

    @classmethod
    def setUpTestData(cls) -> None:
        seed()
        cls.campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        cls.other = Campaign.objects.create(name="Elsewhere", join_code="ELSEWH")
        setting = {row.slug: row for row in CampaignType.objects.all()}
        set_settings(cls.campaign, [setting["khemri"].id])
        set_settings(cls.other, [setting["lustria"].id])
        cls.rows = {
            "khemri": Skill.objects.create(name="Desert Lore", campaign_type=setting["khemri"]),
            "lustria": Skill.objects.create(name="Jungle Lore", campaign_type=setting["lustria"]),
            "mordheim": Skill.objects.create(name="Sprint", campaign_type=setting["mordheim"]),
            "none": Skill.objects.create(name="Dodge"),
            "custom": Skill.objects.create(name="Old Trick", campaign=cls.campaign),
        }

    def in_play(self, campaign: Campaign) -> dict[str, bool]:
        flags = {row.name: getattr(row, "in_play") for row in with_in_play(Skill.objects.all(), campaign.id)}  # noqa: B009
        return {key: flags[row.name] for key, row in self.rows.items()}

    def test_ticked_always_on_unset_and_custom_entries_are_in_play(self) -> None:
        self.assertEqual(
            self.in_play(self.campaign),
            {"khemri": True, "lustria": False, "mordheim": True, "none": True, "custom": True},
        )
        self.assertEqual(self.in_play(self.other)["khemri"], False)
        self.assertEqual(self.in_play(self.other)["lustria"], True)

    def test_set_settings_keeps_the_always_on_ones_and_replaces_the_rest(self) -> None:
        lustria = CampaignType.objects.get(slug="lustria")
        set_settings(self.campaign, [lustria.id])
        ticked = set(self.campaign.campaign_types.values_list("slug", flat=True))
        self.assertEqual(ticked, {"mordheim", "lustria"})
        self.assertEqual(self.in_play(self.campaign)["khemri"], False)

    def test_an_always_on_setting_is_in_play_even_where_no_campaign_lists_it(self) -> None:
        self.campaign.campaign_type_links.all().delete()
        self.assertTrue(self.in_play(self.campaign)["mordheim"])
