from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignMembership, CampaignRole
from apps.core.testing import ReferenceCampaign, build_reference_campaign
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling, LedgerAction, Warband
from apps.warbands.services import ledger
from apps.warbands.services.summary import load_warband_units, warband_gold


class WarbandSummaryServiceTests(TestCase):
    ref: ReferenceCampaign
    warband: Warband

    @classmethod
    def setUpTestData(cls):
        cls.ref = build_reference_campaign(unit_count=1)
        cls.warband = cls.ref.rival_warband

    def test_gold_is_the_stored_balance_the_ledger_keeps(self):
        # the warband was created with its starting gold (500, campaign default)
        rows = [
            (LedgerAction.BUY, -25),
            (LedgerAction.RECRUIT, -40),
            (LedgerAction.SELL, 12),
            (LedgerAction.TRADE, -7),
            (LedgerAction.REWARD, 20),
        ]
        for action, amount in rows:
            ledger.record(self.warband, action, amount, "x")

        self.assertEqual(warband_gold(self.warband.id), 500 - 25 - 40 + 12 - 7 + 20)

    def test_gold_is_zero_without_ledger_rows(self):
        user = get_user_model().objects.create_user(username="empty@example.com", password="x")
        warband = Warband.objects.create(campaign_id=self.ref.campaign_id, user=user, name="Empty")
        self.assertEqual(warband_gold(warband.id), 0)

    def test_rating_counts_living_units_with_the_original_formula(self):
        Hero.objects.create(warband=self.warband, name="Captain", xp=Decimal("12.5"))
        Hero.objects.create(warband=self.warband, name="Ogre", large=True, xp=Decimal("3"))
        Hero.objects.create(warband=self.warband, name="Fallen", xp=Decimal("40"), dead=True)
        group = HenchmenGroup.objects.create(warband=self.warband, name="Swordsmen", xp=Decimal("2"))
        Henchman.objects.bulk_create(
            [
                Henchman(group=group, name="A"),
                Henchman(group=group, name="B"),
                Henchman(group=group, name="C", dead=True),
            ]
        )
        Hireling.objects.create(warband=self.warband, name="Ranger", rating=18, xp=Decimal("4"))

        units = load_warband_units([self.warband.id])[self.warband.id]

        # heroes: (5 + 12.5) + (20 + 3); henchmen: 2 living x (5 + 2); hired sword: 18 + 4
        self.assertEqual(units.rating, 17.5 + 23 + 14 + 22)
        self.assertEqual([row["name"] for row in units.heroes], ["Captain", "Ogre"])

    def test_players_query_count_is_constant_in_warbands(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        url = f"/api/campaigns/{self.ref.campaign_id}/players/"

        with CaptureQueriesContext(connection) as before:
            self.assertEqual(client.get(url).status_code, 200)

        role = CampaignRole.objects.get(slug="player")
        for index in range(3):
            user = get_user_model().objects.create_user(username=f"extra{index}@example.com", password="x")
            CampaignMembership.objects.create(campaign_id=self.ref.campaign_id, user=user, role=role)
            warband = Warband.objects.create(campaign_id=self.ref.campaign_id, user=user, name=f"Extra {index}")
            Hero.objects.create(warband=warband, name=f"Leader {index}")

        with CaptureQueriesContext(connection) as after:
            response = client.get(url)

        self.assertEqual(len(response.data), 5)
        self.assertEqual(len(after), len(before))
