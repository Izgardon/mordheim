"""What a campaign member may do with a warband: the rules the endpoints enforce and the sheet reports.

Each rule is today's server check (design 0.29). `WarbandScopedView` enforces them and `warband_capabilities`
reports them as flags, so the UI can hide what the server would reject. Flag keys are verbs without a `can_`
prefix (design 0.29 §3.5).
"""

from collections.abc import Callable, Mapping
from typing import Any

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import has_campaign_permission
from apps.warbands.models import Warband

Rule = Callable[[Any, Warband, CampaignMembership], bool]  # (user, warband, the user's membership) -> allowed


def is_member(user: Any, warband: Warband, membership: CampaignMembership) -> bool:
    return True  # a membership was found, which is all reading takes


def owns_warband(user: Any, warband: Warband, membership: CampaignMembership) -> bool:
    return bool(warband.user_id == user.id)


def can_edit_warband(user: Any, warband: Warband, membership: CampaignMembership) -> bool:
    """The warband's owner, or anyone holding manage_warbands (owners and admins hold every code)."""
    return owns_warband(user, warband, membership) or has_campaign_permission(membership, "manage_warbands")


WARBAND_RULES: Mapping[str, Rule] = {
    "view": is_member,
    "edit": can_edit_warband,  # warband and unit writes, level-ups, items, resources, the ledger
    "delete": owns_warband,  # warband DELETE: its owner only
}


def warband_capabilities(user: Any, warband: Warband, membership: CampaignMembership) -> dict[str, bool]:
    """Flags for a member of the warband's campaign; costs at most two queries, none for owners and admins."""
    can_edit = can_edit_warband(user, warband, membership)
    return {
        "edit": can_edit,  # warband and unit writes
        "level_up": can_edit,  # unit level-up endpoints
        "manage_items": can_edit,  # stash, item transfers and sales, resources, ledger entries
        "edit_backstory": can_edit,  # backstory is a warband PATCH today (decision 13 narrows it in PR C)
        "delete": owns_warband(user, warband, membership),  # warband DELETE: its owner only
        "add_custom": has_campaign_permission(membership, "add_custom"),  # custom catalogue entries
    }
