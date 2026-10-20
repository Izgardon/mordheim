"""One permission pattern for every campaign route (design 0.29 §6): the endpoint x role matrix, capability truth
and the structure that keeps new views on CampaignScopedView.

Actors: `player` ("Pia", only what joining grants), `granted` ("Gil", a player holding every code), `admin`, `owner`,
plus the outsider (a non-member: 404 on every campaign route) and anonymous (401). Each request runs in a savepoint
that is rolled back, so a DELETE or a cancel doesn't change what the next row sees.
"""

import inspect
from typing import Any

from django.db import connection, transaction
from django.test import RequestFactory
from django.test.utils import CaptureQueriesContext
from django.urls import URLPattern, get_resolver
from django.utils import timezone
from rest_framework.request import Request

from apps.battles.models import Battle
from apps.bestiary.models import BestiaryEntry
from apps.campaigns import views as campaign_views
from apps.campaigns.access import CAMPAIGN_RULES, CAPABILITIES, load_campaign_access
from apps.campaigns.constants import PERMISSION_CODES
from apps.campaigns.models import (
    Campaign,
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignLocation,
)
from apps.campaigns.views.base import CampaignScopedView
from apps.items.models import Item
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .campaign_support import CampaignTestCase, make_user

MEMBERS = ("player", "granted", "admin", "owner")
OK_ALL = (200, 200, 200, 200)

# method, path under campaigns/<id>/, body, expected status for (player, granted, admin, owner)
MATRIX: list[tuple[str, str, dict[str, Any] | None, tuple[int, int, int, int]]] = [
    ("GET", "", None, OK_ALL),
    ("PATCH", "", {"in_progress": True}, (403, 403, 200, 200)),
    ("PATCH", "", {"max_heroes": 5}, (403, 403, 403, 200)),
    ("DELETE", "", {"name": "Shards"}, (403, 403, 403, 403)),  # archived first (decision 5)
    ("POST", "join-code/", {}, (403, 403, 200, 200)),
    ("GET", "players/", None, OK_ALL),
    ("GET", "battle-history/", None, OK_ALL),
    ("GET", "pivotal-moments/", None, OK_ALL),
    ("GET", "top-killers/", None, OK_ALL),
    ("GET", "active-battles/", None, (403, 200, 200, 200)),
    ("POST", "active-battles/{battle}/cancel/", {}, (403, 200, 200, 200)),
    ("GET", "bulletin/", None, OK_ALL),
    ("POST", "bulletin/", {"body": "WTB a horse"}, (201, 201, 201, 201)),
    ("DELETE", "bulletin/{note}/", None, (403, 403, 403, 403)),  # Rex's note: its author only
    ("GET", "encampments/", None, OK_ALL),
    ("POST", "encampments/", {"name": "Camp"}, (403, 201, 201, 201)),
    ("PATCH", "encampments/{camp}/", {"name": "Camp 2"}, (403, 200, 200, 200)),
    ("GET", "locations/", None, OK_ALL),
    ("POST", "locations/", {"name": "Ruin"}, (403, 201, 201, 201)),
    ("PATCH", "locations/{place}/", {"name": "Ruin 2"}, (403, 200, 200, 200)),
    ("GET", "members/", None, (403, 403, 200, 200)),
    ("PUT", "members/{rival}/permissions/", {"permissions": ["add_custom"]}, (403, 403, 200, 200)),
    ("PATCH", "members/{rival}/role/", {"role": "player"}, (403, 403, 403, 200)),
    ("GET", "members/{rival}/removal/", None, (403, 403, 200, 200)),
    ("DELETE", "members/{rival}/", None, (403, 403, 204, 204)),
    ("POST", "ownership/", {"user_id": "{admin}"}, (403, 403, 403, 200)),
    ("POST", "archive/", {}, (403, 403, 403, 200)),
    ("POST", "restore/", {}, (403, 403, 403, 403)),  # not archived: nothing to restore
    ("GET", "leave/", None, (200, 200, 200, 400)),  # the owner hands over first
    ("POST", "leave/", {}, (200, 200, 200, 400)),
    ("GET", "permissions/", None, OK_ALL),
    ("GET", "permissions/me/", None, OK_ALL),
    ("GET", "rules/", None, OK_ALL),
    ("GET", "rules/common/", None, OK_ALL),
    ("POST", "rules/", {"title": "No running"}, (403, 201, 201, 201)),
    ("PATCH", "rules/{rule}/", {"title": "Walk"}, (403, 200, 200, 200)),
    ("DELETE", "rules/{rule}/", None, (403, 204, 204, 204)),
    ("GET", "messages/", None, OK_ALL),
    ("POST", "messages/", {"body": "Hi"}, (201, 201, 201, 201)),
]

# capability -> the request it promises will succeed (a path starting with "/" is outside campaigns/<id>/)
REPRESENTATIVE: dict[str, tuple[str, str, dict[str, Any] | None]] = {
    "edit_settings": ("PATCH", "", {"max_heroes": 5}),
    "start": ("PATCH", "", {"in_progress": True}),
    "delete": ("DELETE", "", {"name": "Shards"}),
    "regenerate_join_code": ("POST", "join-code/", {}),
    "view_members": ("GET", "members/", None),
    "grant_permissions": ("PUT", "members/{rival}/permissions/", {"permissions": ["add_custom"]}),
    "change_roles": ("PATCH", "members/{rival}/role/", {"role": "player"}),
    "remove_members": ("DELETE", "members/{rival}/", None),
    "hand_over": ("POST", "ownership/", {"user_id": "{admin}"}),
    "archive": ("POST", "archive/", {}),
    "restore": ("POST", "restore/", {}),
    "leave": ("POST", "leave/", {}),
    "add_custom": ("POST", "/api/skills/", {"campaign_id": "{campaign}", "name": "Dodge", "type": "Speed"}),
    "manage_items": ("DELETE", "/api/items/{item}/", None),
    "manage_skills": ("DELETE", "/api/skills/{skill}/", None),
    "manage_spells": ("DELETE", "/api/spells/{spell}/", None),
    "manage_specials": ("DELETE", "/api/special/{special}/", None),
    "manage_rules": ("POST", "rules/", {"title": "No running"}),
    "manage_warbands": ("PATCH", "/api/warbands/{rival_warband}/", {"name": "Rats"}),
    "manage_encampments": ("POST", "encampments/", {"name": "Camp"}),
    "manage_locations": ("POST", "locations/", {"name": "Ruin"}),
    "manage_bestiary": ("DELETE", "/api/bestiary/{beast}/", None),
    "manage_battles": ("POST", "active-battles/{battle}/cancel/", {}),
}

NOT_SCOPED = {  # views without a campaign_id, and the players list, whose member check is the list (PERF-41)
    "CampaignListCreateView",
    "JoinCampaignView",
    "CampaignPlayersView",
}


class CampaignAccessFixture(CampaignTestCase):
    """The shared campaign with both pages switched on, one of each record, an inviting battle and `granted`."""

    granted: Any
    refs: dict[str, Any]

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        campaign = cls.campaign
        cls.granted = make_user("granted@example.com", "Gil")
        client = cls.client_class()
        client.force_authenticate(user=cls.granted)
        assert client.post("/api/campaigns/join/", {"join_code": campaign.join_code}, format="json").status_code == 201
        campaign.settings.enable_encampments = campaign.settings.enable_locations = True
        campaign.settings.save()
        note = CampaignBulletinEntry.objects.create(campaign=campaign, user=cls.rival, username="Rex", body="Mine")
        battle = Battle.objects.create(
            campaign=campaign, created_by_user=cls.player, scenario="Ford", status=Battle.STATUS_INVITING
        )
        cls.refs = {
            "campaign": campaign.id,
            "rival": cls.rival.id,
            "admin": cls.admin.id,
            "rival_warband": cls.rival_warband.id,
            "battle": battle.id,
            "note": note.id,
            "camp": CampaignEncampment.objects.create(campaign=campaign, name="Old Camp").id,
            "place": CampaignLocation.objects.create(campaign=campaign, name="Old Ruin").id,
            "rule": CampaignHouseRule.objects.create(campaign=campaign, title="Old rule").id,
            "item": Item.objects.create(campaign=campaign, name="Lucky Charm", type="Miscellaneous").id,
            "skill": Skill.objects.create(campaign=campaign, name="Sprint", type="Speed").id,
            "spell": Spell.objects.create(campaign=campaign, name="Fireball", type="Fire").id,
            "special": Special.objects.create(campaign=campaign, name="Fearsome", type="Trait").id,
            "beast": BestiaryEntry.objects.create(campaign=campaign, name="Rat Ogre", type="Monster").id,
        }

    def setUp(self) -> None:
        super().setUp()
        self.grant(self.granted, *PERMISSION_CODES)

    def path(self, template: str) -> str:
        filled = template.format(**self.refs)
        return filled if filled.startswith("/") else self.url(filled)

    def status_of(self, user: Any, method: str, template: str, body: dict[str, Any] | None = None) -> int:
        """The request's status, with everything it wrote rolled back."""
        self.client.force_authenticate(user=user)  # None: anonymous
        data = {
            key: value.format(**self.refs) if isinstance(value, str) else value for key, value in (body or {}).items()
        }
        with transaction.atomic():
            response = getattr(self.client, method.lower())(self.path(template), data, format="json")
            transaction.set_rollback(True)
        return int(response.status_code)


class AccessMatrixTests(CampaignAccessFixture):
    def test_every_campaign_route_answers_each_role_as_before(self):
        for method, template, body, expected in MATRIX:
            for actor, status in zip(MEMBERS, expected, strict=True):
                with self.subTest(route=f"{method} {template}", actor=actor):
                    self.assertEqual(self.status_of(getattr(self, actor), method, template, body), status)

    def test_outsiders_get_404_and_anonymous_401_everywhere(self):
        for method, template, body, _expected in MATRIX:
            with self.subTest(route=f"{method} {template}"):
                self.assertEqual(self.status_of(self.outsider, method, template, body), 404)
                self.assertEqual(self.status_of(None, method, template, body), 401)

    def test_the_list_and_join_need_only_a_login(self):
        self.assertEqual(self.status_of(self.outsider, "GET", "/api/campaigns/"), 200)
        self.assertEqual(self.status_of(None, "GET", "/api/campaigns/"), 401)
        joined = self.status_of(self.outsider, "POST", "/api/campaigns/join/", {"join_code": self.campaign.join_code})
        self.assertEqual(joined, 201)

    def test_switched_off_pages_are_404_for_every_member(self):
        self.enable_features(encampments=False, locations=False)
        rows = [row for row in MATRIX if row[1].startswith(("encampments/", "locations/"))]
        for method, template, body, _expected in rows:
            for actor in MEMBERS:
                with self.subTest(route=f"{method} {template}", actor=actor):
                    self.assertEqual(self.status_of(getattr(self, actor), method, template, body), 404)

    def test_a_note_is_deleted_by_its_author(self):
        self.assertEqual(self.status_of(self.rival, "DELETE", "bulletin/{note}/"), 204)


class CapabilityTruthTests(CampaignAccessFixture):
    """Each capability is true exactly when its representative request succeeds."""

    def test_every_capability_has_a_representative_request(self):
        self.assertEqual(set(REPRESENTATIVE), set(CAPABILITIES))

    def test_capabilities_match_what_the_server_allows(self):
        for actor in MEMBERS:
            capabilities = self.get_as(getattr(self, actor), self.url()).json()["capabilities"]
            self.assertEqual(list(capabilities), list(CAPABILITIES))
            for name, (method, template, body) in REPRESENTATIVE.items():
                with self.subTest(actor=actor, capability=name):
                    allowed = 200 <= self.status_of(getattr(self, actor), method, template, body) < 300
                    self.assertEqual(capabilities[name], allowed)

    def test_capabilities_match_what_an_archived_campaign_allows(self):
        # decision 5: every write, in the campaign's warbands and catalogue too, answers 403 campaign_archived but
        # restore and delete (the owner's)
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        for actor in MEMBERS:
            capabilities = self.get_as(getattr(self, actor), self.url()).json()["capabilities"]
            for name, (method, template, body) in REPRESENTATIVE.items():
                with self.subTest(actor=actor, capability=name):
                    allowed = 200 <= self.status_of(getattr(self, actor), method, template, body) < 300
                    self.assertEqual(capabilities[name], allowed)

    def test_a_switched_off_page_is_no_capability(self):
        self.enable_features(encampments=False, locations=False)
        capabilities = self.get_as(self.owner, self.url()).json()["capabilities"]
        self.assertEqual((capabilities["manage_encampments"], capabilities["manage_locations"]), (False, False))

    def test_the_detail_costs_three_queries_for_every_role(self):
        for actor in MEMBERS:
            self.client.force_authenticate(user=getattr(self, actor))
            with self.subTest(actor=actor), CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.client.get(self.url()).status_code, 200)
            self.assertLessEqual(len(captured), 3)


class AccessLoadTests(CampaignAccessFixture):
    def request_by(self, user: Any) -> Request:
        request = Request(RequestFactory().get("/"))
        request.user = user
        return request

    def test_one_query_reads_membership_role_settings_and_codes_once_per_request(self):
        request = self.request_by(self.granted)

        with self.assertNumQueries(1):
            access = load_campaign_access(request, self.campaign.id)
            self.assertIs(load_campaign_access(request, self.campaign.id), access)
            assert access is not None
            self.assertEqual(access.codes, sorted(PERMISSION_CODES))
            self.assertTrue(access.feature("enable_encampments"))
        self.assertEqual(access.campaign.settings.max_players, 8)

    def test_a_non_member_has_no_access(self):
        self.assertIsNone(load_campaign_access(self.request_by(self.outsider), self.campaign.id))


class StructureTests(CampaignTestCase):
    """New campaign views can't skip the check: each derives from CampaignScopedView (or is listed here), and each
    method it handles names a rule that exists."""

    def test_every_campaign_view_is_scoped_or_listed(self):
        classes = {name: cls for name, cls in inspect.getmembers(campaign_views, inspect.isclass)}
        scoped = {name for name, cls in classes.items() if issubclass(cls, CampaignScopedView)}
        self.assertEqual(set(classes) - scoped - {"CampaignScopedView"}, NOT_SCOPED)

    def test_every_handled_method_names_a_known_rule(self):
        for name, cls in inspect.getmembers(campaign_views, inspect.isclass):
            if not issubclass(cls, CampaignScopedView) or cls is CampaignScopedView:
                continue
            for method in ("get", "post", "put", "patch", "delete"):
                if hasattr(cls, method):
                    with self.subTest(view=name, method=method):
                        self.assertIn(cls.rules.get(method.upper()), CAMPAIGN_RULES)

    def test_every_campaign_url_routes_to_a_campaign_view(self):
        patterns = [
            entry for entry in get_resolver("apps.campaigns.urls").url_patterns if isinstance(entry, URLPattern)
        ]
        exported = set(campaign_views.__all__)
        for pattern in patterns:
            with self.subTest(route=str(pattern.pattern)):
                self.assertIn(pattern.callback.view_class.__name__, exported)  # type: ignore[attr-defined]
        self.assertEqual(len(patterns), len(exported))
