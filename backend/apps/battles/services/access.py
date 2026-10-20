"""Who may see and act on a battle: campaign members only, and what their role lets them do.

A battle is read with the caller's membership in the same query (`member_role`, None for a non-member) and whether
he holds `manage_battles` (owners and admins always do; it can be granted to players, BATL-NEW-04), so loading a
battle costs one query and its capabilities none.
"""

from django.db.models import Exists, OuterRef, QuerySet, Subquery

from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission
from apps.campaigns.permissions import IMPLICIT_PERMISSION_ROLES

from ..models import Battle, BattleParticipant

MANAGE_BATTLES = "manage_battles"


def scoped_battles(user, campaign_id: int) -> QuerySet[Battle]:
    """The campaign's battles, each with the caller's role (`member_role`) and his manage_battles grant."""
    membership = CampaignMembership.objects.filter(campaign_id=OuterRef("campaign_id"), user=user)
    granted = CampaignMembershipPermission.objects.filter(
        membership__campaign_id=OuterRef("campaign_id"), membership__user=user, permission__code=MANAGE_BATTLES
    )
    return Battle.objects.filter(campaign_id=campaign_id).annotate(
        member_role=Subquery(membership.values("role__slug")[:1]), granted_manage_battles=Exists(granted)
    )


def is_member(battle: Battle) -> bool:
    return getattr(battle, "member_role", None) is not None


def manages_battles(battle: Battle) -> bool:
    """The caller holds manage_battles in the battle's campaign (a battle read through scoped_battles)."""
    role = getattr(battle, "member_role", None)
    return role in IMPLICIT_PERMISSION_ROLES or bool(getattr(battle, "granted_manage_battles", False))


def participant_rows(battle: Battle, user):
    """The caller's participant row, with the user and warband a snapshot reads, without the roster."""
    return (
        BattleParticipant.objects.select_related("user", "warband")
        .defer("roster_json")
        .filter(battle=battle, user=user)
    )
