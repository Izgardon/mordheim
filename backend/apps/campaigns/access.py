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
    def archived(self) -> bool:
        """The campaign is archived: read-only for everyone until its owner restores it (decision 5)."""
        return self.campaign.archived_at is not None

    @property
    def workshop(self) -> bool:
        """The campaign is a workshop (apps/workshop): one player's custom warbands, lists and catalogue entries."""
        return self.campaign.is_workshop

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


def load_campaign_access(
    request: Request, campaign_id: int, extras: Mapping[str, Any] | None = None
) -> CampaignAccess | None:
    """The caller's access to the campaign, None for a non-member; one query, cached on the request. `extras`: more
    of the campaign read in the same query as annotations on the membership (a catalogue list's: cache.py)."""
    cache: dict[Any, CampaignAccess | None] = request.__dict__.setdefault("_campaign_access", {})
    key = (campaign_id, tuple(sorted(extras or {})))
    if key not in cache:
        rows = with_codes(CampaignMembership.objects.select_related("role", "campaign", "campaign__settings"))
        if extras:
            rows = rows.annotate(**extras)
        user: Any = request.user  # authenticated by now (IsAuthenticated runs first)
        # a deleted workshop is gone for its owner too (apps/workshop)
        membership = rows.filter(campaign_id=campaign_id, user=user, campaign__deleted_at__isnull=True).first()
        cache[key] = CampaignAccess(membership) if membership else None
    return cache[key]


Rule = Callable[[CampaignAccess, Any], bool]  # (access, the object acted on or None) -> allowed


def member(access: CampaignAccess, obj: Any = None) -> bool:
    return True  # a membership was found, which is all reading takes


def owner(access: CampaignAccess, obj: Any = None) -> bool:
    return access.role == OWNER


def not_owner(access: CampaignAccess, obj: Any = None) -> bool:
    return access.role != OWNER


def owner_of_archived(access: CampaignAccess, obj: Any = None) -> bool:
    return access.role == OWNER and access.archived


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


def takes_for(access: CampaignAccess, obj: Any = None) -> bool:
    """The warband (`obj`) taking an encampment is his, or he holds manage_encampments (William, 24 Nov 2026: anyone
    takes one, whoever holds it now; the view has checked the Encampments page is on)."""
    return access.has("manage_encampments") or (obj is not None and obj.user_id == access.user_id)


def holds_or_manages(access: CampaignAccess, obj: Any = None) -> bool:
    """The encampment (`obj`) is held by a warband of his, or he holds manage_encampments: who razes it or gives it
    up."""
    if access.has("manage_encampments"):
        return True
    holder = getattr(obj, "holder", None) if obj is not None else None
    return holder is not None and holder.user_id == access.user_id


ROLE_RULES: Mapping[str, Rule] = {
    "edit_settings": owner,  # PATCH with any settings field
    "start": staff,  # PATCH with in_progress alone (decision 2, BUG-13)
    "delete": owner_of_archived,  # for good, archived first (decision 5, CAMP-TWEAK-04)
    "regenerate_join_code": staff,  # decision 1, CAMP-NEW-01
    "view_members": staff,
    "grant_permissions": staff,
    "change_roles": owner,
    "remove_members": staff,  # whom each may remove: services/removal.check_may_remove
    "hand_over": owner,  # ownership goes to an admin (decision 4, CAMP-NEW-02)
    "archive": owner,  # decision 5, CAMP-NEW-04
    "restore": owner_of_archived,
    "remove_posts": staff,  # remove chat posts, "removed by admin" (decision 8, CAMP-NEW-06)
    "leave": not_owner,  # the owner hands over first; alone, leaving archives (decision 4, services/leaving)
    "manage_campaign_rules": staff,  # the campaign's own rules: its owner and admins (William, 7 Nov 2026: "admin only")
}
CODE_RULES: Mapping[str, Rule] = {
    **{code: has(code) for code in PERMISSION_CODES},
    "manage_encampments": with_feature("enable_encampments", "manage_encampments"),
    "manage_locations": with_feature("enable_locations", "manage_locations"),
}


def campaign_only(code: str | None = None) -> Rule:
    """Never in a workshop; in a campaign, held with `code` (every member without one)."""

    def outside_workshop(access: CampaignAccess, obj: Any = None) -> bool:
        return not access.workshop and (code is None or access.has(code))

    return outside_workshop


# what the catalogue does only in a campaign (William, 26 Nov 2026: a workshop is "New + edit own", with no archive):
# the views refuse them in a workshop in their own words (core/catalogue/views.py), and the flags tell the pages
CATALOGUE_PLACE_RULES: Mapping[str, Rule] = {
    "edit_book_catalogue": campaign_only("edit_catalogue"),  # edit, remove or revert a book entry for the campaign
    "archived_catalogue": campaign_only(),  # Show archived (and Restore, with edit_catalogue)
}
CAMPAIGN_RULES: Mapping[str, Rule] = {
    "view": member,
    **ROLE_RULES,
    **CODE_RULES,
    **CATALOGUE_PLACE_RULES,
    "take_encampment": takes_for,  # for a warband (object rule)
    "change_holding": holds_or_manages,  # raze it or give it up (object rule)
}
CAPABILITIES: tuple[str, ...] = (
    *ROLE_RULES,
    *CODE_RULES,
    *CATALOGUE_PLACE_RULES,
)  # the flags: every rule but view and object rules
# what an archived campaign still lets its members do (everything else answers 403 campaign_archived)
KEPT_WHEN_ARCHIVED = frozenset({"view_members", "restore", "delete", "archived_catalogue"})
# what a workshop's player may do there (apps/workshop): write his own catalogue entries and lists, and delete them;
# never a book entry, and no archive (CATALOGUE_PLACE_RULES)
KEPT_IN_WORKSHOP = frozenset({"edit_catalogue", "delete_catalogue"})


def campaign_capabilities(access: CampaignAccess) -> dict[str, bool]:
    """Flags for the campaign payload, from the loaded access: no query. A workshop's are all off but its catalogue's
    (`edit_catalogue`, `delete_catalogue`), as `CampaignScopedView` refuses the rest."""
    if access.workshop:
        return {name: name in KEPT_IN_WORKSHOP and CAMPAIGN_RULES[name](access, None) for name in CAPABILITIES}
    return {
        name: CAMPAIGN_RULES[name](access, None) and (not access.archived or name in KEPT_WHEN_ARCHIVED)
        for name in CAPABILITIES
    }
