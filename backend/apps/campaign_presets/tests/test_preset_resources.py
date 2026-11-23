"""A preset's resources (William, 23 Nov 2026: "settings to own default resources that get added and can't be
deleted ... treasure and wyrdstone for MiM where treasure is the default"): its main resource names every warband's
default, and its others are counters every warband holds and may neither delete nor rename."""

from apps.campaign_presets.models import CampaignPreset
from apps.campaign_presets.services.resources import other_resources
from apps.campaigns.models import CampaignSettings
from apps.campaigns.tests.campaign_support import CampaignTestCase, book_warband_type
from apps.skills.models import Skill
from apps.warbands.models import Warband, WarbandResource


class PresetResourceTests(CampaignTestCase):
    marienburg: CampaignPreset
    sartosa: CampaignPreset
    mordheim: CampaignPreset

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.mordheim = CampaignPreset.objects.create(slug="mordheim", name="Mordheim")
        cls.marienburg = CampaignPreset.objects.create(
            slug="mutiny-in-marienburg", name="Mutiny in Marienburg", main_resource="Treasure", resources=["Wyrdstone"]
        )
        cls.sartosa = CampaignPreset.objects.create(
            slug="sartosa", name="Sartosa", main_resource="Raw Gems", resources=["Grog"]
        )

    def counters(self, warband: Warband) -> list[tuple[str, bool, bool]]:
        rows = WarbandResource.objects.filter(warband=warband).order_by("-is_default", "name")
        return [(row.name, row.is_default, row.fixed) for row in rows]

    def play(self, preset: CampaignPreset | None) -> None:
        response = self.patch_as(self.owner, self.url(), {"preset_id": preset.pk if preset else None})
        self.assertEqual(response.status_code, 200, response.data)

    def test_taking_a_preset_up_renames_the_default_and_fixes_its_others_on_every_warband(self) -> None:
        WarbandResource.objects.create(warband=self.warband, name="wyrdstone", amount=3)  # his own, already held

        self.play(self.marienburg)

        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).default_resource_name, "Treasure")
        self.assertEqual(self.counters(self.warband), [("Treasure", True, False), ("wyrdstone", False, True)])
        self.assertEqual(self.counters(self.rival_warband), [("Treasure", True, False), ("Wyrdstone", False, True)])
        self.assertEqual(WarbandResource.objects.get(warband=self.warband, name="wyrdstone").amount, 3)

    def test_a_warband_raised_later_is_given_them(self) -> None:
        self.play(self.marienburg)
        self.client.force_authenticate(user=self.admin)
        body = {"name": "Late", "warband_type_id": book_warband_type().id, "campaign_id": self.campaign.id}
        created = self.client.post("/api/warbands/", body, format="json")
        self.assertEqual(created.status_code, 201, created.data)

        late = Warband.objects.get(pk=created.data["id"])
        self.assertEqual(self.counters(late), [("Treasure", True, False), ("Wyrdstone", False, True)])

    def test_changing_preset_frees_the_old_ones_and_keeps_their_amounts(self) -> None:
        self.play(self.marienburg)
        WarbandResource.objects.filter(warband=self.warband, name="Wyrdstone").update(amount=4)

        self.play(self.sartosa)

        self.assertEqual(
            self.counters(self.warband),
            [("Raw Gems", True, False), ("Grog", False, True), ("Wyrdstone", False, False)],
        )
        self.assertEqual(WarbandResource.objects.get(warband=self.warband, name="Wyrdstone").amount, 4)

    def test_clearing_the_preset_frees_them_all(self) -> None:
        self.play(self.marienburg)
        self.play(None)
        self.assertFalse(WarbandResource.objects.filter(warband__campaign=self.campaign, fixed=True).exists())

    def test_a_fixed_counter_is_neither_deleted_nor_renamed(self) -> None:
        self.play(self.marienburg)
        fixed = WarbandResource.objects.get(warband=self.warband, name="Wyrdstone")
        base = f"/api/warbands/{self.warband.id}/resources/{fixed.id}/"

        deleted = self.delete_as(self.player, base)
        renamed = self.patch_as(self.player, base, {"name": "Shards"})
        counted = self.patch_as(self.player, base, {"amount": 2})

        self.assertEqual((deleted.status_code, deleted.data["code"]), (400, "fixed_resource"))
        self.assertEqual((renamed.status_code, renamed.data["code"]), (400, "fixed_resource"))
        self.assertEqual((counted.status_code, counted.data["amount"], counted.data["fixed"]), (200, 2, True))

    def test_the_campaigns_resources_list_them_before_any_warband_holds_them(self) -> None:
        self.play(self.marienburg)
        WarbandResource.objects.filter(warband__campaign=self.campaign, fixed=True).delete()

        names = [row["name"] for row in self.get_as(self.owner, self.url("resources/")).data]

        self.assertEqual(names[:2], ["Treasure", "Wyrdstone"])

    def test_the_main_resource_is_one_of_what_the_preset_sets(self) -> None:
        self.play(self.marienburg)
        sets = self.get_as(self.owner, self.url("preset/")).data["sets"]
        self.assertIn(
            {"field": "default_resource_name", "label": "Main resource", "value": "Treasure", "text": "Treasure"},
            [{key: line[key] for key in ("field", "label", "value", "text")} for line in sets],
        )

    def test_a_preset_that_names_none_says_nothing_about_them(self) -> None:
        self.play(self.mordheim)
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).default_resource_name, "Wyrdstone")
        self.assertEqual(other_resources(self.mordheim), [])
        self.assertFalse(WarbandResource.objects.filter(warband__campaign=self.campaign, fixed=True).exists())


class PresetSkillWordingTests(CampaignTestCase):
    """William, 23 Nov 2026, of the Marienburg Annual's errata Mighty Blow: "Can it edit Mighty Blow for that campaign
    setting as if a human edited it"."""

    annual: CampaignPreset
    book: Skill

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.book = Skill.objects.create(name="Mighty Blow", description="+1 Strength in close combat.")
        cls.annual = CampaignPreset.objects.create(
            slug="mim-annual",
            name="Mutiny in Marienburg + Annual",
            skill_wordings=[
                {"skill": "Mighty Blow", "description": "+1 Strength with any hammer or mace."},
                {"skill": "No Such Skill", "description": "Passed over."},
            ],
        )

    def version_of(self, campaign_id: int) -> Skill | None:
        return Skill.objects.filter(campaign_id=campaign_id, replaces=self.book).first()

    def test_taking_the_preset_up_makes_the_campaigns_version_and_leaves_the_book(self) -> None:
        response = self.patch_as(self.owner, self.url(), {"preset_id": self.annual.pk})
        self.assertEqual(response.status_code, 200, response.data)

        version = self.version_of(self.campaign.pk)
        self.assertIsNotNone(version)
        assert version is not None
        self.assertEqual((version.name, version.description), ("Mighty Blow", "+1 Strength with any hammer or mace."))
        self.book.refresh_from_db()
        self.assertEqual(self.book.description, "+1 Strength in close combat.")

    def test_a_campaign_created_with_it_has_the_version_from_the_start(self) -> None:
        created = self.post_as(
            self.owner, "/api/campaigns/", {"name": "Annual", "max_players": 4, "preset_id": self.annual.pk}
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertIsNotNone(self.version_of(created.data["id"]))

    def test_a_version_the_campaign_already_has_is_its_own_and_stays(self) -> None:
        Skill.objects.create(
            name="Mighty Blow", description="House wording.", campaign=self.campaign, replaces=self.book
        )

        self.patch_as(self.owner, self.url(), {"preset_id": self.annual.pk})

        version = self.version_of(self.campaign.pk)
        assert version is not None
        self.assertEqual(version.description, "House wording.")
