"""Raising a demo warband as its player would: the warband (raised from its type's template, with its default resource,
Wyrdstone), its backstory, each hero and henchmen group hired from the template as the hire dialog hires them, a late
recruit who joins without part of the group's kit (his gap), the hired swords hired at their fee, and the stash's
spares bought."""

from dataclasses import dataclass, field
from typing import Any

from .api import Api
from .cast import GroupSpec, HeroSpec, Kit, WarbandSpec
from .catalogue import Book


@dataclass
class Unit:
    """One of the demo's fighters, by handle: what a battle needs to name him and his result."""

    key: str  # "hero:12", "henchman:40", "hireling:3"
    name: str
    unit_type: str
    player: str
    group: str = ""  # a henchman's group handle
    group_name: str = ""
    dead: bool = False

    @property
    def kind(self) -> str:
        return self.key.split(":")[0]

    @property
    def unit_id(self) -> int:
        return int(self.key.split(":")[1])


@dataclass
class Demo:
    """What the seed has made so far: the campaign, the players and their warbands, and every unit by handle."""

    campaign_id: int = 0
    users: dict[str, Any] = field(default_factory=dict)  # player handle -> user
    warbands: dict[str, int] = field(default_factory=dict)  # player handle -> warband id
    wyrdstone: dict[str, int] = field(default_factory=dict)  # player handle -> its default resource (Wyrdstone)
    units: dict[str, Unit] = field(default_factory=dict)
    groups: dict[str, int] = field(default_factory=dict)  # group handle -> group id
    book: Book = field(default_factory=Book)
    notes: list[str] = field(default_factory=list)  # advances the post-game skipped

    def warband_of(self, unit: Unit) -> int:
        return self.warbands[unit.player]

    def roster(self, player: str) -> list[Unit]:
        """The player's living units, in the order they were raised."""
        return [unit for unit in self.units.values() if unit.player == player and not unit.dead]


def _buy(api: Api, user: Any, warband_id: int, target: tuple[str, int | None], kit: Kit, book: Book) -> None:
    target_type, target_id = target
    for name, price in kit:
        item_id = book.item(name)
        if item_id is not None:
            body = {"item_id": item_id, "price": price, "target_type": target_type, "target_id": target_id}
            api.post(user, f"warbands/{warband_id}/purchases/", body)


def _hire(api: Api, demo: Demo, player: str, segment: str, create: dict[str, Any], kit: Kit) -> dict[str, Any]:
    """A hire from the warband's template as the hire dialog's Recruit as makes it: one roster Save (`batch/`) whose
    create names the fighter's key, which fills in the rest (and gives his list's free Dagger), with his kit bought
    at the prices sent; the new unit, as the Save's answer lists it."""
    user, warband_id = demo.users[player], demo.warbands[player]
    found = [(item_id, price) for name, price in kit if (item_id := demo.book.item(name)) is not None]
    purchases = [{"create_index": 0, "item_id": item_id, "quantity": 1, "price": price} for item_id, price in found]
    body = {"create": [create], **({"purchases": purchases} if purchases else {})}
    units = api.post(user, f"warbands/{warband_id}/{segment}/batch/", body)["units"]
    return dict(max(units, key=lambda unit: unit["id"]))  # the newest: ids only grow


def _recruit_hero(api: Api, demo: Demo, spec: HeroSpec, player: str) -> None:
    book = demo.book
    skills = [found for name in spec.skills if (found := book.skill(name))]
    spells = [found for name, lore in spec.spells if (found := book.spell(name, lore))]
    create: dict[str, Any] = {"fighter_key": spec.fighter_key, "name": spec.name}
    create |= {"skill_ids": skills} if skills else {}  # what is sent wins over his template's
    create |= {"spell_ids": spells} if spells else {}
    hero = _hire(api, demo, player, "heroes", create, spec.items)
    demo.units[spec.handle] = Unit(f"hero:{hero['id']}", spec.name, hero["unit_type"], player)


def _late_recruit(api: Api, user: Any, path: str, members: list[dict], name: str, lacks: int | None) -> list[dict]:
    """The group's last recruit joins after its kit was bought, without its last item's row: his gap."""
    rows = api.get(user, path)["items"]
    without = [row["row_id"] for row in rows if lacks is not None and row["id"] == lacks][-1:]
    entries = [{"id": member["id"]} for member in members] + [{"name": name, "without": without}]
    return list(api.patch(user, path, {"henchmen": entries})["henchmen"])


def _recruit_group(api: Api, demo: Demo, spec: GroupSpec, player: str) -> None:
    create = {"fighter_key": spec.fighter_key, "name": spec.name, "henchmen": [{"name": name} for name in spec.members]}
    group = _hire(api, demo, player, "henchmen-groups", create, spec.items)
    members = list(group["henchmen"])
    if spec.late_member:
        path = f"warbands/{demo.warbands[player]}/henchmen-groups/{group['id']}/"
        lacks = demo.book.item(spec.items[-1][0]) if spec.items else None
        members = _late_recruit(api, demo.users[player], path, members, spec.late_member, lacks)
    demo.groups[spec.handle] = group["id"]
    for number, member in enumerate(members, start=1):
        unit = Unit(f"henchman:{member['id']}", member["name"], group["unit_type"], player, spec.handle, spec.name)
        demo.units[f"{spec.handle}.{number}"] = unit


def raise_warband(api: Api, demo: Demo, spec: WarbandSpec) -> None:
    """The player's warband with everything in `spec`, its starting gold spent on it."""
    user, book = demo.users[spec.player], demo.book
    body = {"campaign_id": demo.campaign_id, "name": spec.name, "warband_type_id": book.warband_type(spec.type_slug)}
    warband_id = api.post(user, "warbands/", body)["id"]
    demo.warbands[spec.player] = warband_id
    api.patch(user, f"warbands/{warband_id}/", {"backstory": spec.backstory, "dice_color": spec.dice_color})
    resources = api.get(user, f"warbands/{warband_id}/resources/")  # its default resource, made with it: Wyrdstone
    demo.wyrdstone[spec.player] = next(resource["id"] for resource in resources if resource["is_default"])
    for hero in spec.heroes:
        _recruit_hero(api, demo, hero, spec.player)
    for group in spec.groups:
        _recruit_group(api, demo, group, spec.player)
    for hire in spec.hires:
        sword_id = book.hired_sword(hire.book_name)
        if sword_id is not None:
            body = {"source": "hired_sword", "id": sword_id, "name": hire.name}
            sword = api.post(user, f"warbands/{warband_id}/hirelings/hire/", body)
            demo.units[hire.handle] = Unit(
                f"hireling:{sword['id']}", hire.name, sword.get("unit_type") or "", spec.player
            )
    _buy(api, user, warband_id, ("stash", None), spec.stash, book)
