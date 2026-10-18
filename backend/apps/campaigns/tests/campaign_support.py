"""Shared fixtures for the campaign characterisation tests (pass 4).

The `test_campaign_characterisation_*` modules lock in how the campaign endpoints behave today, before PR A fixes
them and PR B splits `campaigns/views.py`. Known bugs are pinned with their BUGS.md ID and the comment
"Characterises current behaviour (BUG-NN, pinned; flips in PR A)" (or the PR or decision that changes it).

Roles and permission codes are created lazily on the request path today (`_ensure_roles` / `_ensure_permissions`,
cached per process with `lru_cache`). A cached row from another test class's rolled-back transaction would break a
foreign key here, so the caches are cleared before the fixture is built and again when the class is done.
"""

from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignPermission,
    CampaignSettings,
)
from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.notifications.models import Notification
from apps.warbands.models import Warband


def clear_code_caches() -> None:
    """Forget the cached roles and permission codes (the next request reads or creates them again)."""
    _ensure_roles.cache_clear()
    _ensure_permissions.cache_clear()


def make_user(email: str, first_name: str = "") -> Any:
    """A user as registration makes one: the username is the email."""
    return get_user_model().objects.create_user(username=email, email=email, password=None, first_name=first_name)


@override_settings(RATE_LIMIT_ENABLED=False)  # chat, battle and trade writes are throttled per user
class CampaignTestCase(APITestCase):
    """A campaign made through the API, with one user per role.

    `owner` ("Olga") created "Shards"; `admin` ("Ada") joined and was promoted by the owner; `player` ("Pia",
    warband "Monks") and `rival` ("Rex", warband "Rats") joined and hold only `add_custom`, which joining grants.
    `outsider` ("Otto") owns another campaign, `elsewhere`. The owner and the admin have no warband. Every role
    and permission code exists from the start, as on any database where a campaign has been created and joined.
    """

    client: APIClient
    campaign: Campaign
    elsewhere: Campaign
    owner: Any
    admin: Any
    player: Any
    rival: Any
    outsider: Any
    warband: Warband
    rival_warband: Warband

    @classmethod
    def setUpTestData(cls) -> None:
        clear_code_caches()
        cache.clear()
        cls.owner = make_user("owner@example.com", "Olga")
        cls.admin = make_user("admin@example.com", "Ada")
        cls.player = make_user("player@example.com", "Pia")
        cls.rival = make_user("rival@example.com", "Rex")
        cls.outsider = make_user("outsider@example.com", "Otto")
        client = APIClient()

        client.force_authenticate(user=cls.owner)
        created = client.post("/api/campaigns/", {"name": "Shards", "max_players": 8}, format="json")
        assert created.status_code == 201, created.data
        cls.campaign = Campaign.objects.get(id=created.data["id"])
        for user in (cls.admin, cls.player, cls.rival):
            client.force_authenticate(user=user)
            joined = client.post("/api/campaigns/join/", {"join_code": cls.campaign.join_code}, format="json")
            assert joined.status_code == 201, joined.data
        client.force_authenticate(user=cls.owner)
        role_url = f"/api/campaigns/{cls.campaign.id}/members/{cls.admin.id}/role/"
        promoted = client.patch(role_url, {"role": "admin"}, format="json")
        assert promoted.status_code == 200, promoted.data

        cls.warband = cls._create_warband(client, cls.player, "Monks")
        cls.rival_warband = cls._create_warband(client, cls.rival, "Rats")

        client.force_authenticate(user=cls.outsider)
        other = client.post("/api/campaigns/", {"name": "Elsewhere", "max_players": 4}, format="json")
        cls.elsewhere = Campaign.objects.get(id=other.data["id"])

    @classmethod
    def _create_warband(cls, client: APIClient, user: Any, name: str) -> Warband:
        client.force_authenticate(user=user)
        body = {"name": name, "faction": "Mercenaries", "campaign_id": cls.campaign.id}
        response = client.post("/api/warbands/", body, format="json")
        assert response.status_code == 201, response.data
        return Warband.objects.get(id=response.data["id"])

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        clear_code_caches()  # the cached rows were rolled back with the class's data

    def setUp(self) -> None:
        cache.clear()  # throttle counters

    # URLs and requests

    def url(self, suffix: str = "", campaign: Campaign | None = None) -> str:
        """`/api/campaigns/<id>/<suffix>`."""
        return f"/api/campaigns/{(campaign or self.campaign).id}/{suffix}"

    def get_as(self, user: Any, url: str) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.get(url)

    def post_as(self, user: Any, url: str, body: dict[str, Any] | None = None) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.post(url, body or {}, format="json")

    def patch_as(self, user: Any, url: str, body: dict[str, Any]) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.patch(url, body, format="json")

    def put_as(self, user: Any, url: str, body: dict[str, Any]) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.put(url, body, format="json")

    def delete_as(self, user: Any, url: str) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.delete(url)

    def join(self, user: Any, join_code: str | None = None) -> Any:
        return self.post_as(user, "/api/campaigns/join/", {"join_code": join_code or self.campaign.join_code})

    # Data

    def membership(self, user: Any, campaign: Campaign | None = None) -> CampaignMembership:
        return CampaignMembership.objects.select_related("role").get(campaign=campaign or self.campaign, user=user)

    def is_member(self, user: Any) -> bool:
        return CampaignMembership.objects.filter(campaign=self.campaign, user=user).exists()

    def enable_features(self, encampments: bool = True, locations: bool = True) -> None:
        """Switch the Encampments and Locations pages on (or off) directly."""
        CampaignSettings.objects.filter(campaign=self.campaign).update(
            enable_encampments=encampments, enable_locations=locations
        )

    def grant(self, user: Any, *codes: str) -> None:
        """Give a member permission codes directly (the codes must exist)."""
        membership = self.membership(user)
        for code in codes:
            permission = CampaignPermission.objects.get(code=code)
            CampaignMembershipPermission.objects.get_or_create(membership=membership, permission=permission)

    def codes(self, user: Any) -> list[str]:
        """The permission codes stored for a member, sorted."""
        rows = CampaignMembershipPermission.objects.filter(membership=self.membership(user))
        return sorted(rows.values_list("permission__code", flat=True))

    def open_battle(self, status: str = Battle.STATUS_INVITING, users: tuple[Any, ...] = ()) -> Battle:
        """A battle written directly, created by `player` against `rival` (or `users`), each with their warband."""
        users = users or (self.player, self.rival)
        battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=users[0], scenario="Street Fight", status=status
        )
        for user in users:
            BattleParticipant.objects.create(
                battle=battle,
                user=user,
                warband=Warband.objects.get(campaign=self.campaign, user=user),
                status=BattleParticipant.STATUS_INVITED,
            )
        return battle

    def notify(self, user: Any, notification_type: str, reference: Any, campaign: Campaign | None = None) -> Any:
        return Notification.objects.create(
            user=user,
            notification_type=notification_type,
            campaign_id=(campaign or self.campaign).id,
            reference_id=str(reference),
            payload={},
        )

    def listed_notifications(self, user: Any) -> list[tuple[str, str, int]]:
        """(type, reference, campaign id) of each notification `user` sees in GET /notifications/, sorted."""
        response = self.get_as(user, "/api/notifications/")
        self.assertEqual(response.status_code, 200)
        return sorted((row["notification_type"], row["reference_id"], row["campaign_id"]) for row in response.json())
