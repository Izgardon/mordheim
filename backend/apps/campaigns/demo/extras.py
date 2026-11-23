"""The rest of a lived-in campaign, each through its own endpoint: the map (two groups of locations, one with a
table of its own), the encampments, a house rule, the chat, the bounties (one paid, one still open), a completed trade, a
reported result approved by the other player, and optionally a battle left in pre-battle."""

from datetime import timedelta
from typing import Any

from django.utils import timezone

from apps.battles.models import BattleKill
from apps.bounties.models import BountyClaim

from .api import Api
from .battles import Battle
from .plans import BattlePlan
from .raising import Demo

RUBBLE: dict[str, Any] = {
    "title": "Rummaging",
    "dice": "D6",
    "rows": [{"result": "1-5", "text": "Nothing but rubble."}],
}
Place = tuple[str, str, int, int | str, bool, list[dict[str, Any]]]
LOCATION_GROUPS: tuple[tuple[str, str, str, tuple[Place, ...]], ...] = (
    (
        "The East Bank",
        "Burnt-out shops and the merchants' cellars.",
        "",
        (
            (
                "The Merchants' Quarter",
                "Cellars nobody has looted yet. Roll a D6.",
                1,
                1,
                True,
                [{**RUBBLE, "rows": [*RUBBLE["rows"], {"result": "6", "name": "A purse", "text": "D6 gc."}]}],
            ),
            ("Sigmar's Haven", "The last temple standing. A hero may pray for a re-roll.", 1, "all", False, []),
        ),
    ),
    (
        "The Old Town",
        "The comet's crater and the streets round it.",
        "Only warbands that have fought a battle.",
        (("The Pit", "Wyrdstone glitters in the ash. 2 heroes go together.", 2, 2, True, []),),
    ),
)
ENCAMPMENTS = (
    ("cap", "The Eagle's Roost", "A watchtower on the city wall, its stair barricaded."),
    ("snikch", "The Gnawing Hole", "Tunnels under the Pit. Smells of warpstone and wet fur."),
)
CHAT = (
    ("cap", "Muster at the Merchants' Quarter at dusk. Bring rope."),
    ("snikch", "Yes-yes. Bring gold too. Skritt likes gold."),
    ("ilsabet", "The Count sends his regards to Captain Adler. He hopes to meet him again soon."),
    ("ulric", "The pyre is lit. Anyone with a bounty on a necromancer, see me."),
    ("cap", "Good game last night, all. Felix still won't stop talking about the zombie."),
)


def setting_the_scene(api: Api, demo: Demo) -> None:
    """The owner's map, encampments and house rule, and the players' first chat."""
    owner, base = demo.users["cap"], f"campaigns/{demo.campaign_id}/"
    for group_name, description, restrictions, places in LOCATION_GROUPS:
        group = {"name": group_name, "description": description, "restrictions": restrictions}
        group_id = api.post(owner, f"{base}location-groups/", group)["id"]
        for name, rules, least, most, trading, tables in places:
            body = {"group_id": group_id, "name": name, "rules": rules, "min_heroes": least, "max_heroes": most}
            api.post(owner, f"{base}locations/", body | {"takes_trading_action": trading, "tables": tables})
    for player, name, description in ENCAMPMENTS:
        body = {"name": name, "owner_id": demo.users[player].id, "description": description}
        api.post(owner, f"{base}encampments/", body)
    rule = {"title": "Wyrdstone fever", "description": "A double 1 on the exploration dice: one hero misses a game."}
    api.post(owner, f"{base}rules/", rule)
    chat(api, demo, CHAT[:2])


def chat(api: Api, demo: Demo, lines: tuple[tuple[str, str], ...]) -> None:
    for player, body in lines:
        api.post(demo.users[player], f"campaigns/{demo.campaign_id}/messages/", {"body": body})


def post_bounty(api: Api, demo: Demo, poster: str, target: str, amount: int, note: str) -> int:
    body = {"hero_id": demo.units[target].unit_id, "amount": amount, "note": note}
    return int(api.post(demo.users[poster], f"campaigns/{demo.campaign_id}/bounties/", body)["id"])


def claim_and_pay(api: Api, demo: Demo, bounty_id: int, claimant: str, poster: str, target: str) -> None:
    """The claimant names his warband's kill of the target; the poster accepts and the gold moves."""
    kills = BattleKill.objects.filter(
        killer_warband_id=demo.warbands[claimant], victim_hero_id=demo.units[target].unit_id
    )
    base = f"campaigns/{demo.campaign_id}/bounties/{bounty_id}/"
    api.post(demo.users[claimant], f"{base}claims/", {"kill_id": kills.values_list("id", flat=True).latest("id")})
    claim_id = BountyClaim.objects.filter(bounty_id=bounty_id).values_list("id", flat=True).latest("id")
    api.post(demo.users[poster], f"{base}claims/{claim_id}/accept/")


def trade(api: Api, demo: Demo, seller: str, buyer: str, item: str, gold: int, trader: str) -> None:
    """The seller's stash item for the buyer's gold, the buyer's hero doing the haggling; both lock, it completes."""
    base = f"campaigns/{demo.campaign_id}/trade-requests/"
    opened = api.post(demo.users[buyer], base, {"target_user_id": demo.users[seller].id})
    url = f"{base}{opened['id']}/"
    api.post(demo.users[seller], f"{url}accept/")
    api.post(demo.users[seller], f"{url}offer/", {"gold": 0, "items": [{"id": demo.book.item(item), "quantity": 1}]})
    offer = {"trader_id": demo.units[trader].unit_id, "gold": gold, "items": []}
    api.post(demo.users[buyer], f"{url}offer/", offer)
    api.post(demo.users[buyer], f"{url}lock/")
    api.post(demo.users[seller], f"{url}lock/")


def reported_result(api: Api, demo: Demo, reporter: str, opponent: str, scenario: str, days_ago: int) -> int:
    """A battle played away from the app, reported by its winner and approved by the other player."""
    played = (timezone.localdate() - timedelta(days=days_ago)).isoformat()
    body = {
        "participant_user_ids": [demo.users[opponent].id],
        "scenario": scenario,
        "battle_date": played,
        "winner_warband_ids": [demo.warbands[reporter]],
    }
    reported = api.post(demo.users[reporter], f"campaigns/{demo.campaign_id}/battles/report-result/", body)
    battle_id = int(reported["battle"]["id"])
    api.post(demo.users[opponent], f"campaigns/{demo.campaign_id}/battles/{battle_id}/approve-result/")
    return battle_id


def open_battle(api: Api, demo: Demo) -> int:
    """A battle joined and picked but not yet started, to try the battle screen with."""
    plan = BattlePlan(scenario="Street Fight", players=("cap", "snikch"), winners=(), rounds=())
    return Battle(api, demo, plan).open()
