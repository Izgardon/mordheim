"""Building the e2e campaign from scratch, every run.

The campaign an earlier run left is deleted first, the six players are made or reset to their fixed password, then,
in one transaction: they join "E2E Shards" with its fixed join code, raise their warbands, play two battles out and
leave three parked, one at each stage (pre-battle, under way, post-game). `facts()` is what the Playwright suite
reads: the ids it navigates to and the gold it asserts on.
"""

from dataclasses import dataclass, field
from typing import Any

from django.core.management.base import CommandError
from django.db import transaction

from apps.campaigns.demo.api import Api
from apps.campaigns.demo.battles import Battle
from apps.campaigns.demo.build import demo_user, remove_old
from apps.campaigns.demo.raising import Demo, raise_warband
from apps.campaigns.models import Campaign
from apps.warbands.models import Warband

from .cast import CAMPAIGN_NAME, JOIN_CODE, OWNER_EMAIL, PASSWORD, PLAYERS, WARBANDS
from .plans import FIRST_SKIRMISH, PARKED_ACTIVE, PARKED_POSTBATTLE, PARKED_PREBATTLE, SECOND_SKIRMISH


@dataclass
class Built:
    campaign_id: int
    removed: int  # campaigns an earlier run left, deleted
    battles: dict[str, int] = field(default_factory=dict)  # stage -> battle id
    warbands: dict[str, int] = field(default_factory=dict)  # player handle -> warband id
    users: dict[str, int] = field(default_factory=dict)  # player handle -> user id
    fresh_gold: int = 0  # what the untouched warband holds: its template's starting gold
    missing: list[str] = field(default_factory=list)  # catalogue entries the seed asked for and didn't find

    def facts(self) -> dict[str, Any]:
        """The fixture the e2e suite reads (`--emit`): credentials and the ids behind them."""
        return {
            "campaign": {"id": self.campaign_id, "name": CAMPAIGN_NAME, "join_code": JOIN_CODE},
            "password": PASSWORD,
            "users": {
                handle: {
                    "id": self.users[handle],
                    "email": email,
                    "name": name,
                    "warband_id": self.warbands.get(handle),
                }
                for handle, (email, name) in PLAYERS.items()
            },
            "battles": self.battles,
            "fresh_gold": self.fresh_gold,
        }


def found_campaign(api: Api, demo: Demo) -> None:
    """The owner's campaign with the fixed join code, joined by the other five and started."""
    owner = demo.users["owner"]
    body = {"name": CAMPAIGN_NAME, "preset": "1c", "enable_encampments": True, "enable_locations": True}
    campaign = api.post(owner, "campaigns/", body)
    demo.campaign_id = campaign["id"]
    taken = Campaign.objects.filter(join_code=JOIN_CODE).exclude(id=demo.campaign_id)
    if taken.exists():
        raise CommandError(f"Another campaign already holds the join code {JOIN_CODE}: rename or remove it first.")
    Campaign.objects.filter(id=demo.campaign_id).update(join_code=JOIN_CODE)  # no service sets a chosen code
    for handle, user in demo.users.items():
        if handle != "owner":
            api.post(user, "campaigns/join/", {"join_code": JOIN_CODE})
    api.patch(owner, f"campaigns/{demo.campaign_id}/", {"in_progress": True})


def play(api: Api, demo: Demo) -> dict[str, int]:
    """Two battles played to the end, then one parked at each of the three open stages."""
    battles = {}
    battles["ended_first"] = Battle(api, demo, FIRST_SKIRMISH).play()
    battles["ended_second"] = Battle(api, demo, SECOND_SKIRMISH).play()

    postbattle = Battle(api, demo, PARKED_POSTBATTLE)
    battles["postbattle"] = postbattle.open()
    postbattle.ready_and_start()
    postbattle.fight()
    postbattle.finish()  # nobody finalises: every player's post-game is waiting

    battles["prebattle"] = Battle(api, demo, PARKED_PREBATTLE).open()  # created, joined, picked, nobody ready

    active = Battle(api, demo, PARKED_ACTIVE)
    battles["active"] = active.open()
    active.ready_and_start()
    active.fight()
    return battles


def build(*, password: str = PASSWORD) -> Built:
    api, demo = Api(), Demo()
    with transaction.atomic():
        removed = remove_old(CAMPAIGN_NAME, OWNER_EMAIL)
        demo.users = {handle: demo_user(email, name, password) for handle, (email, name) in PLAYERS.items()}
        found_campaign(api, demo)
        for spec in WARBANDS:
            raise_warband(api, demo, spec)
        battles = play(api, demo)
    fresh = Warband.objects.get(id=demo.warbands["fresh"])
    return Built(
        campaign_id=demo.campaign_id,
        removed=removed,
        battles=battles,
        warbands=dict(demo.warbands),
        users={handle: user.id for handle, user in demo.users.items()},
        fresh_gold=fresh.gold,
        missing=demo.book.missing,
    )
