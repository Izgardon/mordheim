"""Leaving a campaign (decision 4, CAMP-NEW-03).

Players and admins leave with removal's clean-up (`removal.take_out`): their open battles close (cancelled up to
active, skipped for them in postbattle), their pending and accepted trades close, their notifications for the
campaign are resolved and the membership goes; their warband, battles, ledger and encampments stay, so rejoining
brings everything back but their grants. The owner is told to hand ownership to an admin first (`hand_over_first`),
unless he is alone in the campaign: then leaving archives it instead, and he stays its owner, able to restore it.
"""

from typing import Any

from apps.realtime.services import send_user_notification

from ..constants import OWNER
from ..errors import CampaignError
from ..models import CampaignMembership
from . import archive, removal, removal_battles

LEFT = "left"
ARCHIVED = "archived"


def preview(membership: CampaignMembership) -> dict[str, Any]:
    """What leaving will close, for the Leave dialog, as removal's preview has it; refused as leaving is."""
    archives = _archives_instead(membership)
    return {**removal.describe(membership.campaign_id, membership.user_id), "archives_campaign": archives}


def leave(membership: CampaignMembership, user: Any) -> str:
    """Leave the campaign (`left`), or archive it when its owner is alone in it (`archived`)."""
    if _archives_instead(membership):
        archive.archive(membership.campaign_id, user)
        return ARCHIVED
    campaign = removal.take_out(membership.campaign_id, user.id, user, mode=removal_battles.LEAVE_MODE)
    send_user_notification(user.id, "membership_left", {"campaign_id": campaign.id, "campaign_name": campaign.name})
    return LEFT


def _archives_instead(membership: CampaignMembership) -> bool:
    """True for an owner alone in the campaign; CampaignError `hand_over_first` for an owner who isn't."""
    if membership.role.slug != OWNER:
        return False
    if CampaignMembership.objects.filter(campaign_id=membership.campaign_id).exclude(id=membership.id).exists():
        detail = "Hand ownership to an admin before you leave."
        raise CampaignError(detail, code="hand_over_first")
    return True
