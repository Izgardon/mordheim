"""Shared test fixtures: a reference campaign and query counting.

Production reaches Neon (London) from Render (Frankfurt), so every SQL query is a
network round trip and query count is effectively latency. The reference campaign
gives the heavy endpoints realistic data to run against, so query-budget tests
can catch N+1 regressions (see apps/core/tests/test_query_budgets.py).
"""

from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.items.models import Item, ItemAvailability, ItemAvailabilityRestriction
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    HiredSword,
    HiredSwordItem,
    Warband,
    WarbandItem,
)
from apps.warbands.utils.trades import TradeHelper


@dataclass
class ReferenceCampaign:
    owner: Any
    player: Any
    campaign_id: int
    warband: Warband
    rival_warband: Warband
    owner_client: APIClient
    ended_battle: Battle


def _create_user(email: str, name: str) -> Any:
    return get_user_model().objects.create_user(username=email, email=email, password="testpass123", first_name=name)


def _authed_client(user: Any) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _create_warband(client: APIClient, campaign_id: int, name: str) -> Warband:
    response = client.post(
        "/api/warbands/", {"name": name, "faction": "Mercenaries", "campaign_id": campaign_id}, format="json"
    )
    assert response.status_code == 201, response.data
    return Warband.objects.get(id=response.data["id"])


def _catalogue_item(name: str, cost: int) -> Item:
    item = Item.objects.create(name=name, type="Melee")
    ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
    return item


def build_reference_campaign(unit_count: int = 3) -> ReferenceCampaign:
    """A campaign with two warbands, `unit_count` of each unit type, catalogue rows and battle history."""
    cache.clear()
    _ensure_roles.cache_clear()
    _ensure_permissions.cache_clear()

    owner = _create_user("owner@example.com", "Owner")
    player = _create_user("player@example.com", "Player")
    owner_client = _authed_client(owner)
    player_client = _authed_client(player)

    created = owner_client.post("/api/campaigns/", {"name": "Reference", "max_players": 6}, format="json")
    assert created.status_code == 201, created.data
    campaign_id = created.data["id"]
    joined = player_client.post("/api/campaigns/join/", {"join_code": created.data["join_code"]}, format="json")
    assert joined.status_code in (200, 201), joined.data

    warband = _create_warband(owner_client, campaign_id, "Iron Vultures")
    rival_warband = _create_warband(player_client, campaign_id, "Night Razors")

    race = Race.objects.create(name="Human", movement=4, weapon_skill=3, ballistic_skill=3, leadership=7)
    items = [_catalogue_item(f"Sword {index}", 10 + index) for index in range(unit_count)]
    skills = [Skill.objects.create(name=f"Skill {index}", type="Combat") for index in range(unit_count)]
    spells = [Spell.objects.create(name=f"Spell {index}", type="Lesser Magic") for index in range(unit_count)]
    specials = [Special.objects.create(name=f"Special {index}", type="Special") for index in range(unit_count)]

    for index in range(unit_count):
        hero = Hero.objects.create(
            warband=warband, race=race, name=f"Hero {index}", unit_type="Champion", is_leader=index == 0
        )
        HeroItem.objects.bulk_create([HeroItem(hero=hero, item=item) for item in items])
        HeroSkill.objects.create(hero=hero, skill=skills[index])
        HeroSpell.objects.create(hero=hero, spell=spells[index])
        HeroSpecial.objects.create(hero=hero, special=specials[index])

        group = HenchmenGroup.objects.create(warband=warband, race=race, name=f"Group {index}", unit_type="Warrior")
        Henchman.objects.bulk_create([Henchman(group=group, name=f"Henchman {index}.{n}") for n in range(3)])
        HenchmenGroupItem.objects.create(henchmen_group=group, item=items[index])

        sword = HiredSword.objects.create(warband=warband, race=race, name=f"Sword {index}", unit_type="Ogre")
        HiredSwordItem.objects.create(hired_sword=sword, item=items[index])

        WarbandItem.objects.create(warband=warband, item=items[index], quantity=1)
        TradeHelper.create_trade(warband=warband, action="Buy", description=f"Sword {index}", price=10)

    ended_battle = None
    for index in range(unit_count):
        battle = Battle.objects.create(
            campaign_id=campaign_id,
            created_by_user=owner,
            scenario=f"Skirmish {index}",
            status=Battle.STATUS_ENDED,
            winner_warband_ids_json=[warband.id],
        )
        for user, user_warband in ((owner, warband), (player, rival_warband)):
            BattleParticipant.objects.create(
                battle=battle,
                user=user,
                warband=user_warband,
                status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            )
        BattleEvent.objects.create(
            battle=battle,
            actor_user=owner,
            type="unit_kill",
            payload_json={"killer": {"warband_id": warband.id}, "victim": {"warband_id": rival_warband.id}},
        )
        ended_battle = battle

    assert ended_battle is not None
    return ReferenceCampaign(
        owner=owner,
        player=player,
        campaign_id=campaign_id,
        warband=warband,
        rival_warband=rival_warband,
        owner_client=owner_client,
        ended_battle=ended_battle,
    )


def add_units_with_items(warband: Warband, count: int, label: str) -> None:
    """Grow a warband by `count` heroes, henchmen groups and hired swords, each carrying two
    items whose availabilities have restriction links (the shape that used to cause N+1s)."""
    race = Race.objects.first()
    restriction, _ = Restriction.objects.get_or_create(type="Warband", restriction=f"{label} only")
    for index in range(count):
        items = [_catalogue_item(f"{label} item {index}.{n}", 5 + n) for n in range(2)]
        for item in items:
            ItemAvailabilityRestriction.objects.create(
                item_availability=item.availabilities.get(), restriction=restriction
            )
        hero = Hero.objects.create(warband=warband, race=race, name=f"{label} hero {index}", unit_type="Youngblood")
        HeroItem.objects.bulk_create([HeroItem(hero=hero, item=item) for item in items])
        group = HenchmenGroup.objects.create(warband=warband, race=race, name=f"{label} group {index}")
        HenchmenGroupItem.objects.bulk_create([HenchmenGroupItem(henchmen_group=group, item=item) for item in items])
        sword = HiredSword.objects.create(warband=warband, race=race, name=f"{label} sword {index}")
        HiredSwordItem.objects.bulk_create([HiredSwordItem(hired_sword=sword, item=item) for item in items])


def add_items_to_units(hero: Hero, group: HenchmenGroup, sword: HiredSword, count: int, label: str) -> None:
    """Give one unit of each kind `count` more items, each with a restriction-linked availability."""
    restriction, _ = Restriction.objects.get_or_create(type="Warband", restriction=f"{label} only")
    items = [_catalogue_item(f"{label} item {index}", 5 + index) for index in range(count)]
    for item in items:
        ItemAvailabilityRestriction.objects.create(item_availability=item.availabilities.get(), restriction=restriction)
    HeroItem.objects.bulk_create([HeroItem(hero=hero, item=item) for item in items])
    HenchmenGroupItem.objects.bulk_create([HenchmenGroupItem(henchmen_group=group, item=item) for item in items])
    HiredSwordItem.objects.bulk_create([HiredSwordItem(hired_sword=sword, item=item) for item in items])


def count_get_queries(client: APIClient, url: str) -> int:
    """Number of SQL queries a GET to `url` runs; fails loudly if the request itself fails."""
    with CaptureQueriesContext(connection) as captured:
        response = client.get(url)
    assert response.status_code == 200, f"GET {url} -> {response.status_code}"
    return len(captured)
