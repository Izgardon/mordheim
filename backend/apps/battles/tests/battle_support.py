"""Shared fixtures for the battle characterisation tests (pass 3).

The `test_battle_characterisation_*` modules lock in how the battle endpoints behave today, before PR A fixes
them and PR B splits `battles/views/shared.py`. Known bugs are pinned with their BUGS.md ID and the comment
"Characterises current behaviour (BUG-NN, pinned; flips in PR A)"; behaviour a pass 3 decision changes says
which decision.
"""

from dataclasses import dataclass, field
from typing import Any
from unittest import mock

from django.test import override_settings

from apps.battles.models import Battle, BattleEvent, BattleParticipant
from apps.items.models import Item, ItemAvailability
from apps.realtime import services as realtime
from apps.warbands.models import Henchman, HenchmenGroup, Hero, HiredSword, Warband
from apps.warbands.tests.roster_support import RosterTestCase


def unit_result(
    unit_key: str,
    *,
    xp: int = 0,
    kills: int = 0,
    dead: bool = False,
    rolls: list[dict[str, Any]] | None = None,
    specials: list[int] | None = None,
    name: str = "",
    keep_stats: bool = False,
) -> dict[str, Any]:
    """One `postbattle_json.unit_results` entry as the postbattle page sends it."""
    return {
        "keep_stats": keep_stats,
        "unit_name": name or unit_key,
        "unit_kind": unit_key.split(":")[0],
        "unit_type": "Trooper",
        "group_name": "",
        "out_of_action": False,
        "kill_count": kills,
        "xp_earned": xp,
        "dead": dead,
        "special_ids": specials or [],
        "serious_injury_rolls": rolls or [],
    }


def injury_roll(rolls: list[int], roll_type: str = "d66", label: str = "Old Battle Wound") -> dict[str, Any]:
    return {
        "roll_type": roll_type,
        "rolls": rolls,
        "result_code": "".join(str(value) for value in rolls),
        "result_label": label,
        "dead_suggestion": False,
    }


def draft(results: dict[str, dict[str, Any]], **sections: Any) -> dict[str, Any]:
    """A whole `postbattle_json`: the unit results plus any of exploration, finds and upkeep."""
    return {"exploration": {"dice_values": [], "resource_id": None}, "unit_results": results, **sections}


@dataclass
class FixtureWarband:
    """The review's finalise fixture (BATL-TEST-07): 5 heroes, 2 hired swords, 8 henchmen in 3 groups."""

    heroes: list[Hero]
    hired_swords: list[HiredSword]
    groups: list[HenchmenGroup]
    henchmen: list[Henchman] = field(default_factory=list)

    @property
    def keys(self) -> list[str]:
        return (
            [f"hero:{hero.id}" for hero in self.heroes]
            + [f"hired_sword:{sword.id}" for sword in self.hired_swords]
            + [f"henchman:{henchman.id}" for henchman in self.henchmen]
        )


def build_fixture_warband(warband: Warband, item: Item) -> FixtureWarband:
    """Units of `warband`, each carrying one `item`; the first hero leads."""
    heroes = [
        Hero.objects.create(warband=warband, name=f"Hero {n}", unit_type="Champion", is_leader=n == 0) for n in range(5)
    ]
    swords = [
        HiredSword.objects.create(warband=warband, name=f"Sword {n}", unit_type="Ogre", upkeep_price=15)
        for n in range(2)
    ]
    groups = [HenchmenGroup.objects.create(warband=warband, name=f"Group {n}", unit_type="Warrior") for n in range(3)]
    henchmen = []
    for group, size in zip(groups, (3, 3, 2), strict=True):
        henchmen += [Henchman.objects.create(group=group, name=f"{group.name}.{n}") for n in range(size)]
        group.henchmen_group_items.create(item=item, cost=5)
    for hero in heroes:
        hero.hero_items.create(item=item, cost=5)
    for sword in swords:
        sword.hired_sword_items.create(item=item, cost=5)
    return FixtureWarband(heroes=heroes, hired_swords=swords, groups=groups, henchmen=henchmen)


def catalogue_item(name: str, cost: int | None, **fields: Any) -> Item:
    item = Item.objects.create(name=name, type="Misc", **fields)
    if cost is not None:
        ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
    return item


@override_settings(RATE_LIMIT_ENABLED=False)  # battle writes are throttled at 60 a minute per user, 240 per IP
class BattleTestCase(RosterTestCase):
    """RosterTestCase's campaign at war: `player` (warband "Monks") fights `viewer` (warband "Rats").

    `campaign_owner` owns the campaign and has no warband; `admin` and `manager` are members without one;
    `outsider` isn't a member. Labels are first names ("playe", "viewe").

    The test runner forces Pusher off, so the realtime helpers the battle views call are wrapped (they still
    run) and their calls recorded in `battle_events` and `user_events`.
    """

    battle_events: mock.MagicMock
    user_events: mock.MagicMock

    def setUp(self) -> None:
        super().setUp()
        self.battle_events = self._record("apps.battles.services.broadcast", "send_battle_event")
        self.user_events = self._record("apps.battles.views.shared", "send_user_notification")

    def _record(self, module: str, name: str) -> mock.MagicMock:
        patcher = mock.patch(f"{module}.{name}", wraps=getattr(realtime, name))
        recorded = patcher.start()
        self.addCleanup(patcher.stop)
        return recorded

    # URLs and requests

    def battles_url(self) -> str:
        return f"/api/campaigns/{self.campaign.id}/battles/"

    def url(self, battle_id: int, action: str) -> str:
        return f"{self.battles_url()}{battle_id}/{action}/"

    def post_as(self, user: Any, url: str, body: dict[str, Any] | None = None) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.post(url, body or {}, format="json")

    def get_as(self, user: Any, url: str) -> Any:
        self.client.force_authenticate(user=user)
        return self.client.get(url)

    def ok(self, response: Any, status: int = 200) -> Any:
        self.assertEqual(response.status_code, status, getattr(response, "data", None))
        return response

    # Moving a battle through its phases (player creates it; everyone else is invited)

    def create_battle(self, opponents: list[Any] | None = None, creator: Any = None) -> int:
        creator = creator or self.player
        ids = [user.id for user in opponents or [self.viewer]]
        body = {"participant_user_ids": ids, "scenario": "Bridge"}
        return int(self.ok(self.post_as(creator, self.battles_url(), body), 201).data["battle"]["id"])

    def to_prebattle(self, opponents: list[Any] | None = None) -> int:
        battle_id = self.create_battle(opponents)
        for user in opponents or [self.viewer]:
            self.ok(self.post_as(user, self.url(battle_id, "join")))
        return battle_id

    def to_active(self, units: dict[Any, list[str]] | None = None) -> int:
        """An active battle; `units` maps each participant to the unit keys they selected."""
        units = units or {self.player: [], self.viewer: []}
        opponents = [user for user in units if user is not self.player]
        battle_id = self.to_prebattle(opponents)
        for user, keys in units.items():
            self.select(user, battle_id, keys)
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        return battle_id

    def to_postbattle(self, units: dict[Any, list[str]] | None = None, winners: list[Warband] | None = None) -> int:
        battle_id = self.to_active(units)
        self.finish(battle_id, winners or [self.warband])
        return battle_id

    def select(self, user: Any, battle_id: int, keys: list[str], **info: dict[str, Any]) -> Any:
        """POST config/ with the selected unit keys; `info` gives unit_information entries by unit key."""
        body = {"selected_unit_keys_json": keys, "unit_information_json": info, "custom_units_json": []}
        return self.ok(self.post_as(user, self.url(battle_id, "config"), body))

    def finish(self, battle_id: int, winners: list[Warband]) -> Any:
        body = {"winner_warband_ids": [warband.id for warband in winners]}
        return self.ok(self.post_as(self.player, self.url(battle_id, "finish"), body))

    def finalize(self, user: Any, battle_id: int, postbattle_json: dict[str, Any]) -> Any:
        return self.post_as(user, self.url(battle_id, "finalize-postbattle"), {"postbattle_json": postbattle_json})

    def kill(self, user: Any, battle_id: int, killer: str, victim: str | None = None, **body: Any) -> Any:
        payload: dict[str, Any] = {"killer_unit_key": killer, **body}
        if victim:
            payload["victim_unit_key"] = victim
        return self.post_as(user, self.url(battle_id, "unit-kill"), payload)

    def use_item(self, user: Any, battle_id: int, payload: dict[str, Any]) -> Any:
        return self.post_as(user, self.url(battle_id, "events"), {"type": "item_used", "payload_json": payload})

    # Reading back

    def battle(self, battle_id: int) -> Battle:
        return Battle.objects.get(id=battle_id)

    def participant(self, battle_id: int, user: Any) -> BattleParticipant:
        return BattleParticipant.objects.get(battle_id=battle_id, user=user)

    def statuses(self, battle_id: int) -> list[str]:
        """Each participant's status, in participant order: by user id, so player, (manager,) viewer."""
        rows = BattleParticipant.objects.filter(battle_id=battle_id).order_by("id")
        return list(rows.values_list("status", flat=True))

    def event_types(self, battle_id: int) -> list[str]:
        return list(BattleEvent.objects.filter(battle_id=battle_id).order_by("id").values_list("type", flat=True))

    def sent(self) -> list[str]:
        """The battle-channel events sent so far, in order."""
        return [call.args[1] for call in self.battle_events.call_args_list]

    def notified(self) -> list[tuple[int, str]]:
        """(user id, event) for each user notification sent so far, in order."""
        return [(call.args[0], call.args[1]) for call in self.user_events.call_args_list]

    def record(self, warband: Warband) -> tuple[int | None, int | None]:
        warband.refresh_from_db()
        return warband.wins, warband.losses
