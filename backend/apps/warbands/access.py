"""What a campaign member may do with a warband, as the capability flags of design 0.29.

Each flag is today's server check, computed with the same helpers the endpoints use, so the UI can
hide what the server would reject. Keys are verbs without a `can_` prefix (design 0.29 §3.5).
"""

from typing import Any

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import has_campaign_permission
from apps.warbands.models import Warband


def warband_capabilities(user: Any, warband: Warband, membership: CampaignMembership) -> dict[str, bool]:
    """Flags for a member of the warband's campaign; costs at most two queries, none for owners and admins."""
    owns = warband.user_id == user.id
    # CanEditWarband: the warband's owner, or anyone holding manage_warbands (owners and admins hold every code).
    can_edit = owns or has_campaign_permission(membership, "manage_warbands")
    return {
        "edit": can_edit,  # warband and unit writes
        "level_up": can_edit,  # unit level-up endpoints
        "manage_items": can_edit,  # stash, item transfers and sales, resources, ledger entries
        "edit_backstory": can_edit,  # backstory is a warband PATCH today (decision 13 narrows it in PR C)
        "delete": owns,  # warband DELETE: its owner only
        "add_custom": has_campaign_permission(membership, "add_custom"),  # custom catalogue entries
    }
