"""What a campaign member may do: the rules campaign endpoints enforce and the campaign payload reports (design 0.29).

`load_campaign_access` reads the caller's membership, role, campaign, settings and permission codes in one query,
once per request. `CampaignScopedView` (views/base.py) checks a rule from `CAMPAIGN_RULES` before the handler, and
`campaign_capabilities` reports the same rules as flags, so the UI can hide what the server would refuse. Each rule
is today's server check (as PR A left them); a product decision changes one line here and both follow.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from rest_framework.request import Request

from .constants import OWNER, PERMISSION_CODES
from .models import Campaign, CampaignMembership, CampaignSettings
from .permissions import IMPLICIT_PERMISSION_ROLES, with_codes


@dataclass(frozen=True)
class CampaignAccess:
    """The caller's membership of one campaign, read with its role, campaign, settings and codes."""

    membership: CampaignMembership

    @property
    def user_id(self) -> int:
        return self.membership.user_id

    @property
    def campaign_id(self) -> int:
        return self.membership.campaign_id

    @property
    def campaign(self) -> Campaign:
        return self.membership.campaign

    @property
    def role(self) -> str:
        return self.membership.role.slug

    @property
    def settings(self) -> CampaignSettings | None:
        return getattr(self.membership.campaign, "settings", None)  # None for a campaign without its settings row

    @property
    def is_staff(self) -> bool:
        return self.role in IMPLICIT_PERMISSION_ROLES

    @property
    def codes(self) -> list[str]:
        """The codes he holds, sorted: every code for owners and admins, his grants for a player."""
        return sorted(PERMISSION_CODES) if self.is_staff else sorted(self.granted)

    @property
    def granted(self) -> list[str]:
        """The codes granted to his membership (read with it, `with_codes`)."""
        return list(getattr(self.membership, "permission_codes", []))

    def has(self, code: str) -> bool:
        return self.is_staff or code in self.granted

    def feature(self, flag: str) -> bool:
        """A settings flag (enable_encampments, enable_locations); off when the campaign has no settings row."""
        return bool(self.settings and getattr(self.settings, flag, False))


def load_campaign_access(request: Request, campaign_id: int) -> CampaignAccess | None:
    """The caller's access to the campaign, None for a non-member; one query, cached on the request."""
    cache: dict[int, CampaignAccess | None] = request.__dict__.setdefault("_campaign_access", {})
    if campaign_id not in cache:
        rows = with_codes(CampaignMembership.objects.select_related("role", "campaign", "campaign__settings"))
        user: Any = request.user  # authenticated by now (IsAuthenticated runs first)
        membership = rows.filter(campaign_id=campaign_id, user=user).first()
        cache[campaign_id] = CampaignAccess(membership) if membership else None
    return cache[campaign_id]


Rule = Callable[[CampaignAccess, Any], bool]  # (access, the object acted on or None) -> allowed


def member(access: CampaignAccess, obj: Any = None) -> bool:
    return True  # a membership was found, which is all reading takes


def owner(access: CampaignAccess, obj: Any = None) -> bool:
    return access.role == OWNER


def staff(access: CampaignAccess, obj: Any = None) -> bool:
    return access.is_staff


def has(code: str) -> Rule:
    def holds(access: CampaignAccess, obj: Any = None) -> bool:
        return access.has(code)

    return holds


def with_feature(flag: str, code: str) -> Rule:
    """The settings flag is on and he holds the code."""

    def switched_on_and_holds(access: CampaignAccess, obj: Any = None) -> bool:
        return access.feature(flag) and access.has(code)

    return switched_on_and_holds


def author(access: CampaignAccess, obj: Any = None) -> bool:
    """He wrote it (a bulletin note)."""
    return obj is not None and obj.user_id == access.user_id


ROLE_RULES: Mapping[str, Rule] = {
    "edit_settings": owner,  # PATCH with any settings field
    "start": staff,  # PATCH with in_progress alone (decision 2, BUG-13)
    "delete": owner,
    "regenerate_join_code": staff,  # decision 1, CAMP-NEW-01
    "view_members": staff,
    "grant_permissions": staff,
    "change_roles": owner,
    "remove_members": staff,  # whom each may remove: services/removal.check_may_remove
    "hand_over": owner,  # ownership goes to an admin (decision 4, CAMP-NEW-02)
}
CODE_RULES: Mapping[str, Rule] = {
    **{code: has(code) for code in PERMISSION_CODES},
    "manage_encampments": with_feature("enable_encampments", "manage_encampments"),
    "manage_locations": with_feature("enable_locations", "manage_locations"),
}
CAMPAIGN_RULES: Mapping[str, Rule] = {
    "view": member,
    **ROLE_RULES,
    **CODE_RULES,
    "delete_bulletin_entry": author,  # an object rule: check_rule("delete_bulletin_entry", entry)
}
CAPABILITIES: tuple[str, ...] = (*ROLE_RULES, *CODE_RULES)  # the flags: every rule but view and object rules


def campaign_capabilities(access: CampaignAccess) -> dict[str, bool]:
    """Flags for the campaign payload, from the loaded access: no query."""
    return {name: CAMPAIGN_RULES[name](access, None) for name in CAPABILITIES}
