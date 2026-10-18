"""Roles and permission codes: where they come from, the grant PUT and the code catalogue (BUG-15, CAMP-TEST-08).

No migration seeds roles or codes: they are created with `get_or_create` on the request path, the roles by the first
campaign create and the codes by the first request that needs them (`views.py:97-120`). The code list has drifted
from the codes the views check, and the grant PUT drops what it doesn't know.
"""

import re
import unittest
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.campaigns.management.commands import seed_campaign_users
from apps.campaigns.models import CampaignPermission, CampaignRole
from apps.campaigns.views import PERMISSION_SEED

from .campaign_support import CampaignTestCase, clear_code_caches, make_user

SEEDED_CODES = [
    "add_custom",
    "manage_items",
    "manage_skills",
    "manage_rules",
    "manage_warbands",
    "manage_encampments",
    "manage_locations",
    "manage_bestiary",
]
_CHECKED_CODE = re.compile(r"has_campaign_permission\(\s*\w+\s*,\s*\"([a-z_]+)\"\s*\)")


def codes_checked_in_source() -> set[str]:
    """Every literal code passed to `has_campaign_permission` outside the tests."""
    found: set[str] = set()
    for path in (Path(settings.BASE_DIR) / "apps").rglob("*.py"):
        if "tests" not in path.parts and "migrations" not in path.parts:
            found.update(_CHECKED_CODE.findall(path.read_text(encoding="utf-8")))
    return found


class FreshDatabaseTests(APITestCase):
    """A migrated database before any campaign request (no fixture: the shared one creates the codes)."""

    def setUp(self) -> None:
        cache.clear()
        clear_code_caches()
        self.addCleanup(clear_code_caches)

    def test_a_fresh_database_holds_no_roles_and_no_codes(self):
        # Characterises current behaviour (BUG-15 / design 0.29 Q4, pinned; flips in PR A's seed migration)
        self.assertEqual(CampaignRole.objects.count(), 0)
        self.assertEqual(CampaignPermission.objects.count(), 0)

    def test_the_first_create_makes_the_roles_and_the_first_detail_read_makes_the_codes(self):
        # Characterises current behaviour (BUG-15, pinned; flips in PR A): codes appear on the request path
        owner = make_user("owner@example.com", "Olga")
        self.client.force_authenticate(user=owner)

        created = self.client.post("/api/campaigns/", {"name": "Shards", "max_players": 4}, format="json")

        self.assertEqual(sorted(CampaignRole.objects.values_list("slug", flat=True)), ["admin", "owner", "player"])
        self.assertEqual(CampaignPermission.objects.count(), 0)

        detail = self.client.get(f"/api/campaigns/{created.data['id']}/")

        self.assertEqual(detail.data["permissions"], sorted(SEEDED_CODES))
        self.assertEqual(list(CampaignPermission.objects.order_by("id").values_list("code", flat=True)), SEEDED_CODES)


class PermissionCatalogueTests(CampaignTestCase):
    def test_the_seed_lists_eight_codes(self):
        self.assertEqual([code for code, _name in PERMISSION_SEED], SEEDED_CODES)

    @unittest.expectedFailure
    def test_every_code_a_view_checks_exists(self):
        # BUG-15, CAMP-TEST-08 (expected failure until PR A): spells and specials check codes nobody can hold
        self.assertEqual(codes_checked_in_source() - set(SEEDED_CODES), set())

    def test_the_seed_command_has_its_own_copy_without_encampments(self):
        # Characterises current behaviour (BUG-15 / IMP-64, pinned; flips in PR A's constants module)
        command_codes = [code for code, _name in seed_campaign_users.PERMISSION_SEED]
        self.assertEqual(set(SEEDED_CODES) - set(command_codes), {"manage_encampments"})

    def test_any_member_reads_the_catalogue_in_seed_order(self):
        # GET /permissions/ has no caller in the frontend (BUG-15); code and name only, no description
        expected = [{"code": code, "name": name} for code, name in PERMISSION_SEED]
        for user in (self.owner, self.player):
            with self.subTest(user=user.first_name):
                response = self.get_as(user, self.url("permissions/"))
                self.assertEqual((response.status_code, response.json()), (200, expected))
        self.assertEqual(self.get_as(self.outsider, self.url("permissions/")).status_code, 404)

    def test_owners_and_admins_hold_every_code_and_players_their_grants(self):
        for user, expected in ((self.owner, sorted(SEEDED_CODES)), (self.admin, sorted(SEEDED_CODES))):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url()).data["permissions"], expected)
                mine = self.get_as(user, self.url("permissions/me/")).json()
                self.assertEqual(sorted(row["code"] for row in mine), expected)
        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], ["add_custom"])
        self.assertEqual(self.codes(self.admin), ["add_custom"])  # the admin's join grant is still stored


class GrantTests(CampaignTestCase):
    def put_grants(self, actor, target, codes):
        return self.put_as(actor, self.url(f"members/{target.id}/permissions/"), {"permissions": codes})

    def test_unknown_codes_are_dropped_silently(self):
        # Characterises current behaviour (BUG-15, pinned; flips in PR A: 400 unknown_permission)
        response = self.put_grants(self.owner, self.player, ["manage_items", "manage_spells", "manage_features", "x"])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"code": "manage_items", "name": "Manage items"}])
        self.assertEqual(self.codes(self.player), ["manage_items"])

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
        self.enable_features()
        body = {"name": "Dockside"}
        self.assertEqual(self.post_as(self.player, self.url("encampments/"), body).status_code, 403)

        self.put_grants(self.owner, self.player, ["manage_encampments"])

        self.assertEqual(self.post_as(self.player, self.url("encampments/"), body).status_code, 201)
