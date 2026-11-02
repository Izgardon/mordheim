"""Building the demo campaign from scratch, every time.

The seed's own rows are found and removed first: the campaign named "The Shattered Crown" that the captain owns (and
everything in it, as its owner's permanent delete removes it). The four `@mordheim.test` users are kept, or made, with
their names and password set again; nothing else is touched. Then, in one transaction: the players join, raise their
warbands, play the battles in order (a bounty posted before the one it is claimed in, a trade after a find), and a
reported result is approved.
"""

from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.battles.models import Battle as BattleRow
from apps.campaigns.constants import OWNER
from apps.campaigns.models import Campaign
from apps.campaigns.services.archive import delete_permanently
from apps.users.services.accounts import create_account, rename, set_new_password

from . import extras
from .api import Api
from .battles import Battle
from .cast import CAMPAIGN_NAME, CAPTAIN_EMAIL, PASSWORD, PLAYERS
from .plans import AMBUSH, FIRST_LIGHT, GRAVE_HUNT, HIDDEN_HOARD, THE_PIT, THE_SQUARE
from .raising import Demo, raise_warband
from .warbands import WARBANDS


@dataclass
class Built:
    campaign_id: int
    removed: int  # earlier demo campaigns deleted
    battles_ended: int
    open_battle_id: int | None
    missing: list[str]  # catalogue entries the demo asked for and didn't find
    notes: list[str]  # what the post-game warned it skipped


def own_campaigns() -> list[Campaign]:
    """The demo campaigns an earlier run made: its name, owned by the captain."""
    return list(
        Campaign.objects.filter(
            name=CAMPAIGN_NAME, memberships__role__slug=OWNER, memberships__user__username=CAPTAIN_EMAIL
        ).distinct()
    )


def remove_old() -> int:
    campaigns = own_campaigns()
    for campaign in campaigns:
        owner = campaign.memberships.get(role__slug=OWNER).user
        delete_permanently(campaign, campaign.name, owner)
    return len(campaigns)


def demo_user(email: str, name: str) -> Any:
    """The demo user with this email, made or brought back to his name and the demo password."""
    user = get_user_model().objects.filter(username=email).first()
    if user is None:
        return create_account(email, name, PASSWORD)
    user.email, user.is_active = email, True  # no service sets these: written on the row
    user.save(update_fields=["email", "is_active"])
    rename(user, name)
    set_new_password(user, PASSWORD)
    return user


def found_campaign(api: Api, demo: Demo) -> None:
    """The captain's campaign (Up to 1c, encampments and locations on), joined by the other three and started."""
    owner = demo.users["cap"]
    body = {"name": CAMPAIGN_NAME, "preset": "1c", "enable_encampments": True, "enable_locations": True}
    campaign = api.post(owner, "campaigns/", body)
    demo.campaign_id = campaign["id"]
    for player, user in demo.users.items():
        if player != "cap":
            api.post(user, "campaigns/join/", {"join_code": campaign["join_code"]})
    api.patch(owner, f"campaigns/{demo.campaign_id}/", {"in_progress": True})


def play_season(api: Api, demo: Demo) -> None:
    """The battles in order, with what happens between them."""
    Battle(api, demo, FIRST_LIGHT).play()
    extras.post_bounty(api, demo, "snikch", "cap.konrad", 30, "For the Captain's head. Skritt wants his sword too.")
    Battle(api, demo, GRAVE_HUNT).play()
    mortis = extras.post_bounty(api, demo, "ulric", "ilsabet.mortis", 40, "The necromancer burns. Bring proof.")
    Battle(api, demo, THE_PIT).play()
    extras.claim_and_pay(api, demo, mortis, "cap", "ulric", "ilsabet.mortis")
    extras.trade(api, demo, seller="ilsabet", buyer="cap", item="Lantern", gold=8, trader="cap.dieter")
    extras.chat(api, demo, extras.CHAT[2:4])
    Battle(api, demo, AMBUSH).play()
    Battle(api, demo, THE_SQUARE).play()
    Battle(api, demo, HIDDEN_HOARD).play()
    extras.reported_result(api, demo, "ulric", "snikch", "Breakthrough", days_ago=2)
    extras.chat(api, demo, extras.CHAT[4:])


def build(*, with_open_battle: bool = False) -> Built:
    api, demo = Api(), Demo()
    with transaction.atomic():
        removed = remove_old()
        demo.users = {player: demo_user(email, name) for player, (email, name) in PLAYERS.items()}
        found_campaign(api, demo)
        extras.setting_the_scene(api, demo)
        for spec in WARBANDS:
            raise_warband(api, demo, spec)
        play_season(api, demo)
        open_id = extras.open_battle(api, demo) if with_open_battle else None
    ended = BattleRow.objects.filter(campaign_id=demo.campaign_id, status=BattleRow.STATUS_ENDED).count()
    return Built(demo.campaign_id, removed, ended, open_id, demo.book.missing, demo.notes)
