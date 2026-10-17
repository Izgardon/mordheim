"""GET /api/warbands/<id>/sheet/ (PERF-24): the whole sheet in one request, with capability flags."""

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission, CampaignPermission
from apps.warbands.models import Henchman, WarbandResource
from apps.warbands.utils.trades import TradeHelper

from .roster_support import HENCHMEN, HERO, HIRED_SWORD, RosterTestCase, make_unit

ALL_FLAGS = ("edit", "level_up", "manage_items", "edit_backstory", "delete", "add_custom")


def flags(*granted: str) -> dict[str, bool]:
    return {name: name in granted for name in ALL_FLAGS}


EDITOR = ("edit", "level_up", "manage_items", "edit_backstory")


class WarbandSheetTests(RosterTestCase):
    def _url(self, warband_id: int | None = None) -> str:
        return f"/api/warbands/{warband_id or self.warband.id}/sheet/"

    def _populate(self) -> None:
        hero = make_unit(HERO, self.warband, race=self.race, is_leader=True, xp=3, large=True)
        hero.hero_items.create(item=self.sword, cost=10)
        hero.hero_items.create(item=self.axe)
        hero.hero_skills.create(skill=self.skills[0])
        hero.hero_specials.create(special=self.specials[0])
        hero.hero_spells.create(spell=self.spells[0])
        make_unit(HERO, self.warband, name="Fallen hero", dead=True)
        group = make_unit(HENCHMEN, self.warband, race=self.other_race, xp=2, members=("Alpha", "Beta"))
        Henchman.objects.create(group=group, name="Fallen", dead=True)
        group.henchmen_group_items.create(item=self.sword, cost=10)
        group.henchmen_group_skills.create(skill=self.skills[1])
        sword = make_unit(HIRED_SWORD, self.warband, rating=12, xp=1)
        sword.hired_sword_items.create(item=self.axe, cost=5)
        sword.hired_sword_specials.create(special=self.large)
        WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=2)
        TradeHelper.create_trade(warband=self.warband, action="Starting Gold", description="Gold", price=500)
        TradeHelper.create_trade(warband=self.warband, action="Buy", description="Sword", price=10)

    def test_the_sheet_holds_the_same_bodies_as_the_separate_endpoints(self):
        self._populate()
        base = f"/api/warbands/{self.warband.id}/"

        sheet = self.client.get(self._url()).json()

        self.assertEqual(
            list(sheet), ["warband", "summary", "capabilities", "heroes", "henchmen_groups", "hired_swords"]
        )
        self.assertEqual(sheet["warband"], self.client.get(base).json())
        self.assertEqual(sheet["summary"], self.client.get(f"{base}summary/").json())
        for key, segment in (
            ("heroes", "heroes"),
            ("henchmen_groups", "henchmen-groups"),
            ("hired_swords", "hired-swords"),
        ):
            with self.subTest(units=key):
                self.assertEqual(sheet[key], self.client.get(f"{base}{segment}/detail/").json())
        self.assertEqual([m["name"] for m in sheet["henchmen_groups"][0]["henchmen"]], ["Alpha", "Beta"])
        self.assertEqual(len(sheet["heroes"]), 1)

    def test_an_empty_warband_has_an_empty_roster(self):
        sheet = self.client.get(self._url()).json()
        self.assertEqual((sheet["heroes"], sheet["henchmen_groups"], sheet["hired_swords"]), ([], [], []))
        self.assertEqual((sheet["summary"]["rating"], sheet["summary"]["gold"]), (0, 0))

    def test_capabilities_follow_todays_permission_checks(self):
        expected = {
            "player": flags(*EDITOR, "delete"),  # owns the warband; no add_custom grant
            "campaign_owner": flags(*EDITOR, "add_custom"),
            "admin": flags(*EDITOR, "add_custom"),
            "manager": flags(*EDITOR),  # a player holding manage_warbands
            "viewer": flags(),
        }
        for name, capabilities in expected.items():
            with self.subTest(user=name):
                self.client.force_authenticate(user=getattr(self, name))
                self.assertEqual(self.client.get(self._url()).json()["capabilities"], capabilities)
                # and they agree with the server: a no-op PATCH of the warband is allowed exactly when edit is
                patched = self.client.patch(f"/api/warbands/{self.warband.id}/", {}, format="json")
                self.assertEqual(patched.status_code != 403, capabilities["edit"])

    def test_add_custom_follows_the_grant(self):
        grant, _ = CampaignPermission.objects.get_or_create(code="add_custom", defaults={"name": "Add custom"})
        membership = CampaignMembership.objects.get(campaign=self.campaign, user=self.viewer)
        CampaignMembershipPermission.objects.create(membership=membership, permission=grant)
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get(self._url()).json()["capabilities"], flags("add_custom"))

    def test_only_campaign_members_can_read_it(self):
        self.client.force_authenticate(user=self.viewer)  # a member who doesn't own the warband
        self.assertEqual(self.client.get(self._url()).status_code, 200)

        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(self._url())
        self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))

        self.client.force_authenticate(user=self.player)
        response = self.client.get(self._url(999999))
        self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))

        self.client.force_authenticate(user=None)
        anonymous_detail = self.client.get(f"/api/warbands/{self.warband.id}/")
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            (response.status_code, response.json()), (anonymous_detail.status_code, anonymous_detail.json())
        )
