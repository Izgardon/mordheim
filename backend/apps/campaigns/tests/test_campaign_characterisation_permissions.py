"""Roles and permission codes: where they come from, the grant PUT and the code catalogue (BUG-15, CAMP-TEST-08).

Migration 0014 seeds every role and code from a frozen copy of `apps/campaigns/constants.py`, so a fresh database
has them before its first request and no request creates them (design 0.29 Q4). The seed command reads the same
constants, and every code a view checks is in them.
"""

import io
import re
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.campaigns.constants import PERMISSION_CODES, PERMISSIONS
from apps.campaigns.models import CampaignEncampment, CampaignPermission, CampaignRole

from .campaign_support import CampaignTestCase, make_user

_CHECKED_CODE = re.compile(r"has_campaign_permission\(\s*\w+\s*,\s*\"([a-z_]+)\"\s*\)")


def codes_checked_in_source() -> set[str]:
    """Every literal code passed to `has_campaign_permission` outside the tests."""
    found: set[str] = set()
    for path in (Path(settings.BASE_DIR) / "apps").rglob("*.py"):
        if "tests" not in path.parts and "migrations" not in path.parts:
            found.update(_CHECKED_CODE.findall(path.read_text(encoding="utf-8")))
    return found


class FreshDatabaseTests(APITestCase):
    """A migrated database before any campaign request (no fixture)."""

    def setUp(self) -> None:
        cache.clear()

    def test_a_fresh_database_holds_every_role_and_code(self):
        # BUG-15 / design 0.29 Q4: seeded by migration 0014
        self.assertEqual(sorted(CampaignRole.objects.values_list("slug", flat=True)), ["admin", "owner", "player"])
        labels = dict(CampaignPermission.objects.values_list("code", "name"))
        self.assertEqual(labels, {entry.code: entry.label for entry in PERMISSIONS})

    def test_requests_create_no_roles_or_codes(self):
        # BUG-15, CAMP-CQ-03: nothing on the request path creates them any more
        owner = make_user("owner@example.com", "Olga")
        player = make_user("player@example.com", "Pia")
        before = (CampaignRole.objects.count(), CampaignPermission.objects.count())
        self.client.force_authenticate(user=owner)

        created = self.client.post("/api/campaigns/", {"name": "Shards", "max_players": 4}, format="json")
        detail = self.client.get(f"/api/campaigns/{created.data['id']}/")
        self.client.force_authenticate(user=player)
        joined = self.client.post("/api/campaigns/join/", {"join_code": created.data["join_code"]}, format="json")

        self.assertEqual((created.data["role"], joined.data["role"]), ("owner", "player"))
        self.assertEqual(detail.data["permissions"], sorted(PERMISSION_CODES))
        self.assertEqual((CampaignRole.objects.count(), CampaignPermission.objects.count()), before)

    def test_the_seed_command_reads_the_constants(self):
        # IMP-64: one list; the command upserts it, so it works on a database emptied by hand too
        CampaignPermission.objects.all().delete()

        call_command("seed_campaign_users", count=3, stdout=io.StringIO())

        self.assertEqual(sorted(CampaignPermission.objects.values_list("code", flat=True)), sorted(PERMISSION_CODES))


class PermissionCatalogueTests(CampaignTestCase):
    def test_the_constants_list_eleven_codes(self):
        # design 0.29 Q1: manage_spells seeded, manage_features renamed manage_specials
        self.assertEqual(
            list(PERMISSION_CODES),
            [
                "add_custom",
                "manage_items",
                "manage_skills",
                "manage_spells",
                "manage_specials",
                "manage_rules",
                "manage_warbands",
                "manage_encampments",
                "manage_locations",
                "manage_bestiary",
                "manage_battles",
            ],
        )

    def test_every_code_a_view_checks_exists(self):
        # BUG-15, CAMP-TEST-08: spells and specials checked codes nobody could hold
        self.assertEqual(codes_checked_in_source() - set(PERMISSION_CODES), set())
        self.assertLessEqual({"manage_spells", "manage_specials"}, codes_checked_in_source())

    def test_any_member_reads_the_catalogue_with_labels_and_descriptions(self):
        # BUG-15: what the grant menu is built from (it used to be code and name only)
        expected = [{"code": e.code, "label": e.label, "description": e.description} for e in PERMISSIONS]
        for user in (self.owner, self.player):
            with self.subTest(user=user.first_name):
                response = self.get_as(user, self.url("permissions/"))
                self.assertEqual((response.status_code, response.json()), (200, expected))
        self.assertEqual(self.get_as(self.outsider, self.url("permissions/")).status_code, 404)

        grants_url = self.url(f"members/{self.player.id}/permissions/")
        granted = self.put_as(self.owner, grants_url, {"permissions": ["manage_rules", "add_custom"]})
        mine = self.get_as(self.player, self.url("permissions/me/")).json()

        self.assertEqual(granted.json(), [expected[5], expected[0]])  # in the order sent
        self.assertEqual(mine, [expected[0], expected[5]])  # in the catalogue's order

    def test_owners_and_admins_hold_every_code_and_players_their_grants(self):
        for user in (self.owner, self.admin):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url()).data["permissions"], sorted(PERMISSION_CODES))
                mine = self.get_as(user, self.url("permissions/me/")).json()
                self.assertEqual(sorted(row["code"] for row in mine), sorted(PERMISSION_CODES))
        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], ["add_custom"])
        self.assertEqual(self.codes(self.admin), ["add_custom"])  # the admin's join grant is still stored

    def test_a_player_granted_the_new_codes_can_edit_spells_and_specials(self):
        # BUG-15: the grant reaches the spells and specials writes it gates
        self.grant(self.player, "manage_spells", "manage_specials")
        for kind in ("spells", "special"):
            with self.subTest(kind=kind):
                self.client.force_authenticate(user=self.admin)
                body = {"name": f"House {kind}", "type": "Custom", "campaign_id": self.campaign.id}
                created = self.client.post(f"/api/{kind}/", body, format="json")
                self.assertEqual(created.status_code, 201, created.data)
                renamed = self.patch_as(self.player, f"/api/{kind}/{created.data['id']}/", {"name": "Renamed"})
                self.assertEqual(renamed.status_code, 200, renamed.data)


class GrantTests(CampaignTestCase):
    def put_grants(self, actor, target, codes):
        return self.put_as(actor, self.url(f"members/{target.id}/permissions/"), {"permissions": codes})

    def test_unknown_codes_are_refused_and_nothing_changes(self):
        # BUG-15: 400 unknown_permission (they used to be dropped silently); manage_spells is a real code now
        response = self.put_grants(self.owner, self.player, ["manage_items", "manage_spells", "manage_features", "x"])

        self.assertEqual(response.status_code, 400)
        detail = "Unknown permission: manage_features, x."
        self.assertEqual(
            response.json(),
            {"detail": detail, "code": "unknown_permission", "fields": {"permissions": [detail]}},
        )
        self.assertEqual(self.codes(self.player), ["add_custom"])

        granted = self.put_grants(self.owner, self.player, ["manage_spells", "manage_items"])

        self.assertEqual([row["code"] for row in granted.json()], ["manage_spells", "manage_items"])
        self.assertEqual(self.codes(self.player), ["manage_items", "manage_spells"])

    def test_the_put_replaces_the_grants_after_tidying_the_codes(self):
        blank = self.put_grants(self.admin, self.player, ["manage_items", " "])
        self.assertEqual((blank.status_code, list(blank.json())), (400, ["permissions"]))

        response = self.put_grants(self.admin, self.player, [" Manage_Items ", "manage_items", "manage_rules"])

        self.assertEqual([row["code"] for row in response.json()], ["manage_items", "manage_rules"])
        self.assertEqual(self.codes(self.player), ["manage_items", "manage_rules"])  # add_custom is gone

        cleared = self.put_grants(self.owner, self.player, [])

        self.assertEqual((cleared.status_code, cleared.json()), (200, []))
        self.assertEqual(self.codes(self.player), [])
        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], [])

    def test_only_owners_and_admins_grant_and_only_to_players(self):
        self.assertEqual(self.put_grants(self.rival, self.player, ["manage_items"]).status_code, 403)
        self.assertEqual(self.put_grants(self.player, self.player, ["manage_items"]).status_code, 403)
        self.assertEqual(self.put_grants(self.outsider, self.player, ["manage_items"]).status_code, 404)
        self.assertEqual(self.put_grants(self.owner, self.outsider, ["manage_items"]).status_code, 404)
        for target in (self.admin, self.owner):
            with self.subTest(target=target.first_name):
                response = self.put_grants(self.admin, target, ["manage_items"])
                detail = "Permissions are managed automatically for admins and owners."
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        missing = self.put_as(self.owner, self.url(f"members/{self.player.id}/permissions/"), {})
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(self.codes(self.player), ["add_custom"])

    def test_a_grant_opens_the_matching_write(self):
        # an encampment nobody owns needs manage_encampments (adding one no longer does: decision 9)
        self.enable_features()
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")
        url = self.url(f"encampments/{camp.id}/")
        self.assertEqual(self.patch_as(self.player, url, {"name": "Wharf"}).status_code, 403)

        self.put_grants(self.owner, self.player, ["manage_encampments"])

        self.assertEqual(self.patch_as(self.player, url, {"name": "Wharf"}).status_code, 200)
