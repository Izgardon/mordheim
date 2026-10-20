"""Joining a campaign with its code (BUG-49, CAMP-TEST-10).

The checks and the insert run in one transaction under the campaign row's lock, so two joins for the last seat, or
one player joining twice at once, run one after the other: the second sees the first's membership. A unique
violation that gets past the lock anyway (a membership written by another path) is still "Already a member".
"""

from typing import Any

from django.db import IntegrityError, transaction

from ..constants import JOIN_GRANTS, PLAYER
from ..errors import Refused
from ..models import Campaign, CampaignMembership
from . import codes

ALREADY_A_MEMBER = "Already a member"


def join_campaign(user: Any, join_code: str) -> Campaign:
    """Make `user` a player of the campaign with this code, with the join grants; Refused when he can't join."""
    try:
        with transaction.atomic():
            rows = Campaign.objects.select_related("settings").select_for_update(of=("self",))
            campaign = rows.filter(join_code=join_code).first()
            if campaign is None:
                raise Refused("Campaign not found", status=404)
            members = CampaignMembership.objects.filter(campaign=campaign)
            if members.filter(user=user).exists():
                raise Refused(ALREADY_A_MEMBER)
            if members.count() >= campaign.max_players:
                raise Refused("Campaign is full")
            membership = CampaignMembership.objects.create(campaign=campaign, user=user, role_id=codes.role_ref(PLAYER))
            codes.grant_on_join(membership, JOIN_GRANTS)
    except IntegrityError as error:
        if "unique_campaign_membership" not in str(error):
            raise
        raise Refused(ALREADY_A_MEMBER) from error
    return campaign
