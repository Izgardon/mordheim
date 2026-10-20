"""Archiving a campaign, restoring it and deleting it for good (decision 5, CAMP-NEW-04, CAMP-TWEAK-04): the owner
only.

An archived campaign is read-only for everyone (403 `campaign_archived`, `errors.CampaignArchived`) until its
owner restores it; reads go on as before. Archiving closes what is open as removing every member would, in one
transaction under the campaign row's lock: pending and accepted trades are cancelled (one that ran out expires),
each open battle is cancelled, or, once a player has applied his postbattle, its fight ends and postbattle closes
for everyone still in it (`removal_battles.close_for_archive`), and every unresolved notification of the campaign
is resolved. The battles' players get the battle events after commit.

Deleting for good is a separate step, only for an archived campaign and only with its name typed in: the campaign
goes with everything in it (warbands, battles, trades, logs, house rules and their items) and its notifications.
"""

from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.battles.models import Battle
from apps.battles.services.broadcast import bump_state_version
from apps.battles.services.locks import locked
from apps.notifications.models import Notification

from ..errors import CampaignArchived, CampaignError
from ..models import Campaign
from . import removal_battles
from .removal import Closed, close_trades, publish_closed


def archive(campaign_id: int, actor_user: Any) -> Campaign:
    """Archive the campaign, closing its trades, battles and notifications; CampaignArchived if it already is."""
    closed = Closed()
    with transaction.atomic():
        campaign = Campaign.objects.select_for_update().get(id=campaign_id)
        if campaign.archived_at is not None:
            raise CampaignArchived()
        close_trades(campaign_id)
        _close_battles(campaign_id, actor_user, closed)
        Notification.objects.filter(campaign_id=campaign_id, is_resolved=False).update(
            is_resolved=True, resolved_at=timezone.now()
        )
        campaign.archived_at, campaign.archived_by = timezone.now(), actor_user
        campaign.save(update_fields=["archived_at", "archived_by", "updated_at"])
    publish_closed(closed, actor_user, removal_battles.ARCHIVE_MODE)
    return campaign


def restore(campaign_id: int) -> None:
    """The campaign can change again; what archiving closed stays closed."""
    Campaign.objects.filter(id=campaign_id).update(archived_at=None, archived_by=None, updated_at=timezone.now())


def delete_permanently(campaign: Campaign, name: Any) -> None:
    """Destroy the (archived) campaign, everything in it and its notifications, once `name` is its name; a 400
    `name_mismatch` otherwise (CAMP-TWEAK-04, CAMP-TEST-28)."""
    if not isinstance(name, str) or name.strip() != campaign.name.strip():
        detail = "Type the campaign's name to delete it for good."
        raise CampaignError(detail, code="name_mismatch", fields={"name": [detail]})
    with transaction.atomic():
        Notification.objects.filter(campaign_id=campaign.id).delete()  # a plain integer, so nothing cascades
        campaign.delete()


def _close_battles(campaign_id: int, actor_user: Any, closed: Closed) -> None:
    rows = Battle.objects.filter(campaign_id=campaign_id, status__in=removal_battles.OPEN_STATUSES).order_by("id")
    for battle in locked(rows):
        events = removal_battles.close_for_archive(battle, actor_user)
        if events:
            closed.battles.append((battle.id, events, bump_state_version(battle)))
