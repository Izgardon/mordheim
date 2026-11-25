"""Making a workshop (the workshop plan, docs/plans/workshop.md): the hidden campaign of one custom warband or one
custom warband list, owned by its maker, never listed, joined or played in.

It is made as a campaign is (`campaigns/services/campaigns.py`): the campaign row, its settings row on the app's
defaults (500 gc, Mordheim's exploration chart) and its owner's membership, all or nothing. It differs where a
workshop must: **every setting is ticked**, so everything in the book is in play; no preset, so no rules, charts,
locations or encampments; no scenarios and no plots; and a share code, eight capitals and digits without the
lookalikes 0, O, 1, I and L, that anyone signed in imports it by.
"""

import secrets
from typing import Any

from apps.campaigns.constants import OWNER
from apps.campaigns.in_play import set_settings
from apps.campaigns.models import (
    SHARE_CODE_LENGTH,
    WORKSHOP,
    Campaign,
    CampaignMembership,
    CampaignSettings,
    CampaignType,
)
from apps.campaigns.services import codes
from apps.campaigns.services.campaigns import settings_at_creation, unique_join_code

SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L


def new_share_code() -> str:
    return "".join(secrets.choice(SHARE_CODE_ALPHABET) for _ in range(SHARE_CODE_LENGTH))


def unique_share_code() -> str:
    """A code no workshop uses, deleted ones included (the unique column has the last word)."""
    for _ in range(20):
        code = new_share_code()
        if not Campaign.objects.filter(share_code=code).exists():
            return code
    return new_share_code()


def make_workshop(owner: Any, holds: str, name: str) -> Campaign:
    """A new workshop holding `holds` (a warband or a list), in the caller's transaction."""
    workshop = Campaign.objects.create(
        name=name, join_code=unique_join_code(), kind=WORKSHOP, holds=holds, share_code=unique_share_code()
    )
    CampaignSettings.objects.create(campaign=workshop, **settings_at_creation({}, None))
    set_settings(workshop, CampaignType.objects.values_list("id", flat=True))  # everything in the book is in play
    CampaignMembership.objects.create(campaign=workshop, user=owner, role_id=codes.role_ref(OWNER))
    return workshop
