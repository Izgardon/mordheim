"""A player's workshop (the workshop plan, docs/plans/workshop.md, version 2): the one hidden campaign holding all his
custom warbands, his warband lists and his own catalogue entries, made on his first use and never before.

It is made as a campaign is (`campaigns/services/campaigns.py`): the campaign row, its settings row on the app's
defaults (500 gc, Mordheim's exploration chart) and his owner's membership. It differs where a workshop must: it ticks
no settings, because every setting is in play in a workshop (apps/campaigns/in_play.py computes it), and it gets no
preset, scenarios, rules, charts, locations, encampments or plots. One live workshop per player is the database's
rule (`one_workshop_per_player`), so two first uses at once make one.
"""

from typing import Any

from django.db import IntegrityError, transaction

from apps.campaigns.constants import OWNER
from apps.campaigns.models import WORKSHOP, Campaign, CampaignMembership, CampaignSettings
from apps.campaigns.services import codes
from apps.campaigns.services.campaigns import settings_at_creation, unique_join_code

WORKSHOP_NAME = "Workshop"


def live_workshops() -> Any:
    return Campaign.objects.filter(kind=WORKSHOP, deleted_at__isnull=True)


def workshop_of(user: Any) -> Campaign | None:
    """The player's workshop, or None before his first use (one query)."""
    found: Campaign | None = live_workshops().select_related("settings").filter(workshop_owner=user).first()
    return found


def workshop_for(user: Any) -> Campaign:
    """The player's workshop, made now if he has none (one query when he has; five when it is made)."""
    found = workshop_of(user)
    if found is not None:
        return found
    try:
        with transaction.atomic():
            workshop = Campaign.objects.create(
                name=WORKSHOP_NAME, join_code=unique_join_code(), kind=WORKSHOP, workshop_owner=user
            )
            CampaignSettings.objects.create(campaign=workshop, **settings_at_creation({}, None))
            CampaignMembership.objects.create(campaign=workshop, user=user, role_id=codes.role_ref(OWNER))
    except IntegrityError as error:  # his first use twice at once: the other request made it
        if "one_workshop_per_player" not in str(error):
            raise
        made = workshop_of(user)
        assert made is not None
        return made
    return workshop
