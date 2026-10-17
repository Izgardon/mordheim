"""Characterisation: who may read and write roster units (ROST-TEST-11, pass 1).

Today: any campaign member may read; the warband owner, campaign owner, admin or a member
with manage_warbands may write; other members get 403 on writes; non-members get 404 on
everything. Locked before the WarbandScopedView refactor (design 0.29).
"""

from typing import Any

from rest_framework.test import APIClient

from apps.warbands.models import Warband

from .roster_support import HENCHMEN, KINDS, Kind, RosterTestCase, create_payload, make_unit, unit_url

EDITORS = ("player", "campaign_owner", "admin", "manager")


class RosterPermissionCharacterisationTests(RosterTestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.campaign_settings.max_heroes = 100
        cls.campaign_settings.max_hired_swords = 100
        cls.campaign_settings.save()

    def _as(self, role: str) -> None:
        self.client.force_authenticate(user=getattr(self, role))

    def _reads(self, kind: Kind, unit: Any) -> dict[str, str]:
        return {
            "list": unit_url(kind, self.warband.id),
            "detail-list": unit_url(kind, self.warband.id, suffix="detail/"),
            "detail": unit_url(kind, self.warband.id, unit.id),
            "kill-history": unit_url(kind, self.warband.id, unit.id, "kill-history/"),
        }

    def _write(self, kind: Kind, action: str) -> Any:
        """Run one write against a fresh unit; returns (response, unit)."""
        unit = make_unit(kind, self.warband, level_up=1, weapon_skill=3)
        if action == "create":
            return self.client.post(unit_url(kind, self.warband.id), create_payload(kind), format="json"), unit
        if action == "update":
            url = unit_url(kind, self.warband.id, unit.id)
            return self.client.patch(url, {"name": "Changed"}, format="json"), unit
        if action == "delete":
            return self.client.delete(unit_url(kind, self.warband.id, unit.id)), unit
        url = unit_url(kind, self.warband.id, unit.id, "level-up/")
        return self.client.post(url, {"payload": {"advance": {"id": "WS"}}}, format="json"), unit

    def test_every_member_can_read_and_non_members_get_404(self):
        for kind in KINDS:
            unit = make_unit(kind, self.warband)
            for role in (*EDITORS, "viewer", "outsider"):
                self._as(role)
                for name, url in self._reads(kind, unit).items():
                    with self.subTest(kind=kind.key, role=role, endpoint=name):
                        response = self.client.get(url)
                        if role == "outsider":
                            self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
                        else:
                            self.assertEqual(response.status_code, 200)

    def test_editors_can_write(self):
        expected = {"create": 201, "update": 200, "delete": 204, "level-up": 200}
        for kind in KINDS:
            for role in EDITORS:
                self._as(role)
                for action, status_code in expected.items():
                    with self.subTest(kind=kind.key, role=role, action=action):
                        response, _ = self._write(kind, action)
                        self.assertEqual(response.status_code, status_code)

    def test_other_members_get_403_and_nothing_changes(self):
        self._as("viewer")
        for kind in KINDS:
            for action in ("create", "update", "delete", "level-up"):
                with self.subTest(kind=kind.key, action=action):
                    before = kind.model.objects.count()
                    response, unit = self._write(kind, action)
                    self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
                    self.assertEqual(kind.model.objects.count(), before + 1)  # only the fixture unit was added
                    unit.refresh_from_db()
                    self.assertEqual((unit.name, unit.level_up, unit.weapon_skill), (f"Test {kind.key}", 1, 3))

    def test_non_members_get_404_on_writes(self):
        self._as("outsider")
        for kind in KINDS:
            for action in ("create", "update", "delete", "level-up"):
                with self.subTest(kind=kind.key, action=action):
                    response, unit = self._write(kind, action)
                    self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
                    self.assertTrue(kind.model.objects.filter(id=unit.id).exists())

    def test_permission_is_checked_before_the_unit_lookup(self):
        # A viewer writing to a unit that doesn't exist is told 403, not 404.
        self._as("viewer")
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                url = unit_url(kind, self.warband.id, 999999)
                self.assertEqual(self.client.patch(url, {"name": "x"}, format="json").status_code, 403)
                self.assertEqual(self.client.delete(url).status_code, 403)
                self.assertEqual(self.client.post(f"{url}level-up/", {}, format="json").status_code, 403)

    def test_anonymous_requests_are_401(self):
        anonymous = APIClient()
        for kind in KINDS:
            unit = make_unit(kind, self.warband)
            for name, url in self._reads(kind, unit).items():
                with self.subTest(kind=kind.key, endpoint=name):
                    self.assertEqual(anonymous.get(url).status_code, 401)
            with self.subTest(kind=kind.key, endpoint="create"):
                response = anonymous.post(unit_url(kind, self.warband.id), create_payload(kind), format="json")
                self.assertEqual(response.status_code, 401)

    def test_viewer_can_edit_their_own_warband(self):
        self._as("viewer")
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.rival)
                response = self.client.patch(unit_url(kind, self.rival.id, unit.id), {"name": "Mine"}, format="json")
                self.assertEqual(response.status_code, 200)

    def test_only_the_warband_owner_can_delete_the_warband(self):
        for role in ("campaign_owner", "admin", "manager", "viewer"):
            with self.subTest(role=role):
                self._as(role)
                response = self.client.delete(f"/api/warbands/{self.warband.id}/")
                self.assertEqual((response.status_code, response.json()), (403, {"detail": "Forbidden"}))
        self._as("outsider")
        self.assertEqual(self.client.delete(f"/api/warbands/{self.warband.id}/").status_code, 404)
        self._as("player")
        self.assertEqual(self.client.delete(f"/api/warbands/{self.warband.id}/").status_code, 204)
        self.assertFalse(Warband.objects.filter(id=self.warband.id).exists())

    def test_henchmen_create_by_a_viewer_is_403_before_validation(self):
        self._as("viewer")
        response = self.client.post(unit_url(HENCHMEN, self.warband.id), {}, format="json")
        self.assertEqual(response.status_code, 403)
