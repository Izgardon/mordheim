"""Roles and permission codes: where they come from, the grant PUT and the code catalogue (BUG-15, CAMP-TEST-08).

Migration 0014 seeds every role and code from a frozen copy of `apps/campaigns/constants.py`, so a fresh database
has them before its first request and no request creates them (design 0.29 Q4). The seed command reads the same
constants, and every code a view checks is in them.
"""

import importlib
import io
import re
from pathlib import Path

from django.apps import apps as django_apps
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.campaigns.constants import PERMISSION_CODES, PERMISSIONS
from apps.campaigns.models import CampaignEncampment, CampaignPermission, CampaignRole
from apps.core.catalogue.views import CATALOGUE_RULES

from .campaign_support import CampaignTestCase, make_user

_CHECKED_CODE = re.compile(r"has_campaign_permission\(\s*\w+\s*,\s*\"([a-z_]+)\"\s*\)")
EDIT = "edit_catalogue"  # what joining grants (pass 5 decision 4)
RETIRED_CODES = ("add_custom", "manage_items", "manage_skills", "manage_spells", "manage_specials", "manage_bestiary")


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
    def test_the_constants_list_seven_codes(self):
        # pass 5 decisions 4 and 5: edit_catalogue and delete_catalogue replaced add_custom, manage_items,
        # manage_skills, manage_spells, manage_specials and manage_bestiary (migration 0023)
        self.assertEqual(
            list(PERMISSION_CODES),
            [
                "edit_catalogue",
                "delete_catalogue",
                "manage_rules",
                "manage_warbands",
                "manage_encampments",
                "manage_locations",
                "manage_battles",
            ],
        )

    def test_every_code_a_view_checks_exists(self):
        # BUG-15, CAMP-TEST-08: spells and specials checked codes nobody could hold; no view checks a retired code
        self.assertEqual(codes_checked_in_source() - set(PERMISSION_CODES), set())
        # the catalogue views check their codes through the campaign rules since PR B (IMP-79), not by a literal call
        self.assertLessEqual({"edit_catalogue", "delete_catalogue"}, set(CATALOGUE_RULES.values()))
        self.assertEqual(codes_checked_in_source() & set(RETIRED_CODES), set())

    def test_any_member_reads_the_catalogue_with_labels_and_descriptions(self):
        # BUG-15: what the grant menu is built from (it used to be code and name only)
        expected = [{"code": e.code, "label": e.label, "description": e.description} for e in PERMISSIONS]
        for user in (self.owner, self.player):
            with self.subTest(user=user.first_name):
                response = self.get_as(user, self.url("permissions/"))
                self.assertEqual((response.status_code, response.json()), (200, expected))
        self.assertEqual(self.get_as(self.outsider, self.url("permissions/")).status_code, 404)

        grants_url = self.url(f"members/{self.player.id}/permissions/")
        granted = self.put_as(self.owner, grants_url, {"permissions": ["manage_rules", EDIT]})
        mine = self.get_as(self.player, self.url("permissions/me/")).json()

        self.assertEqual(granted.json(), [expected[2], expected[0]])  # in the order sent
        self.assertEqual(mine, [expected[0], expected[2]])  # in the catalogue's order

    def test_owners_and_admins_hold_every_code_and_players_their_grants(self):
        for user in (self.owner, self.admin):
            with self.subTest(user=user.first_name):
                self.assertEqual(self.get_as(user, self.url()).data["permissions"], sorted(PERMISSION_CODES))
                mine = self.get_as(user, self.url("permissions/me/")).json()
                self.assertEqual(sorted(row["code"] for row in mine), sorted(PERMISSION_CODES))
        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], [EDIT])
        self.assertEqual(self.codes(self.admin), [EDIT])  # the admin's join grant is still stored

    def test_the_retired_catalogue_codes_are_gone_and_edit_catalogue_edits_every_kind(self):
        # decision 4: one code for the catalogue, joining grants it; a grant of a retired code is unknown
        self.assertFalse(CampaignPermission.objects.filter(code__in=RETIRED_CODES).exists())
        refused = self.put_as(self.owner, self.url(f"members/{self.player.id}/permissions/"), {"permissions": ["manage_spells"]})  # fmt: skip
        self.assertEqual((refused.status_code, refused.json()["code"]), (400, "unknown_permission"))
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
        # BUG-15: 400 unknown_permission (they used to be dropped silently); manage_features was renamed manage_specials in pass 4 and retired in pass 5
        response = self.put_grants(
            self.owner, self.player, ["delete_catalogue", "manage_battles", "manage_features", "x"]
        )

        self.assertEqual(response.status_code, 400)
        detail = "Unknown permission: manage_features, x."
        self.assertEqual(
            response.json(),
            {"detail": detail, "code": "unknown_permission", "fields": {"permissions": [detail]}},
        )
        self.assertEqual(self.codes(self.player), [EDIT])

        granted = self.put_grants(self.owner, self.player, ["manage_battles", "delete_catalogue"])

        self.assertEqual([row["code"] for row in granted.json()], ["manage_battles", "delete_catalogue"])
        self.assertEqual(self.codes(self.player), ["delete_catalogue", "manage_battles"])

    def test_the_put_replaces_the_grants_after_tidying_the_codes(self):
        blank = self.put_grants(self.admin, self.player, ["delete_catalogue", " "])
        self.assertEqual((blank.status_code, list(blank.json())), (400, ["permissions"]))

        response = self.put_grants(self.admin, self.player, [" Delete_Catalogue ", "delete_catalogue", "manage_rules"])

        self.assertEqual([row["code"] for row in response.json()], ["delete_catalogue", "manage_rules"])
        self.assertEqual(self.codes(self.player), ["delete_catalogue", "manage_rules"])  # edit_catalogue is gone

        cleared = self.put_grants(self.owner, self.player, [])

        self.assertEqual((cleared.status_code, cleared.json()), (200, []))
        self.assertEqual(self.codes(self.player), [])
        self.assertEqual(self.get_as(self.player, self.url()).data["permissions"], [])

    def test_only_owners_and_admins_grant_and_only_to_players(self):
        self.assertEqual(self.put_grants(self.rival, self.player, ["delete_catalogue"]).status_code, 403)
        self.assertEqual(self.put_grants(self.player, self.player, ["delete_catalogue"]).status_code, 403)
        self.assertEqual(self.put_grants(self.outsider, self.player, ["delete_catalogue"]).status_code, 404)
        self.assertEqual(self.put_grants(self.owner, self.outsider, ["delete_catalogue"]).status_code, 404)
        for target in (self.admin, self.owner):
            with self.subTest(target=target.first_name):
                response = self.put_grants(self.admin, target, ["delete_catalogue"])
                detail = "Permissions are managed automatically for admins and owners."
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        missing = self.put_as(self.owner, self.url(f"members/{self.player.id}/permissions/"), {})
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(self.codes(self.player), [EDIT])

    def test_a_grant_opens_the_matching_write(self):
        # an encampment nobody owns needs manage_encampments (adding one no longer does: decision 9)
        self.enable_features()
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")
        url = self.url(f"encampments/{camp.id}/")
        self.assertEqual(self.patch_as(self.player, url, {"name": "Wharf"}).status_code, 403)

        self.put_grants(self.owner, self.player, ["manage_encampments"])

        self.assertEqual(self.patch_as(self.player, url, {"name": "Wharf"}).status_code, 200)


class CatalogueCodesMigrationTests(CampaignTestCase):
    """Migration 0023 on a database migrated before pass 5 (it also runs on every test database, from empty)."""

    def test_add_custom_becomes_edit_catalogue_with_its_grants_and_the_per_kind_codes_go(self):
        old_join = CampaignPermission.objects.get(code=EDIT)
        old_join.code, old_join.name = "add_custom", "Add custom"  # what the player's join grant was
        old_join.save()
        CampaignPermission.objects.filter(code="delete_catalogue").delete()
        manage_items = CampaignPermission.objects.create(code="manage_items", name="Manage items")
        self.grant(self.player, "manage_items")
        migration = importlib.import_module("apps.campaigns.migrations.0023_catalogue_permissions")

        migration.forwards(django_apps, None)
        migration.forwards(django_apps, None)  # and again: nothing changes

        self.assertEqual(self.codes(self.player), [EDIT])
        self.assertFalse(CampaignPermission.objects.filter(id=manage_items.id).exists())
        labels = dict(CampaignPermission.objects.values_list("code", "name"))
        self.assertEqual(labels, {entry.code: entry.label for entry in PERMISSIONS})
