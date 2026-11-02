"""Who is in the demo campaign: the players, and the shape of the warbands they raise (warbands.py).

Units are named by a handle ("cap.konrad", a henchman "cap.warriors.1") that the battle plans use. Profiles are
M, WS, BS, S, T, W, I, A, Ld. Items are (name, price paid); a group's items are bought once per member.
"""

from dataclasses import dataclass, field

CAPTAIN_EMAIL = "captain@mordheim.test"
PASSWORD = "password"
CAMPAIGN_NAME = "The Shattered Crown"
EMAIL_DOMAIN = "@mordheim.test"

# handle: (email, display name)
PLAYERS: dict[str, tuple[str, str]] = {
    "cap": (CAPTAIN_EMAIL, "Cap"),
    "snikch": ("player2@mordheim.test", "Snikch"),
    "ilsabet": ("player3@mordheim.test", "Lady Ilsabet"),
    "ulric": ("player4@mordheim.test", "Brother Ulric"),
}

Stats = tuple[int, int, int, int, int, int, int, int, int]
Kit = tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class HeroSpec:
    handle: str
    name: str
    unit_type: str
    race: str
    price: int
    xp: int
    stats: Stats
    access: tuple[str, ...]
    items: Kit = ()
    skills: tuple[str, ...] = ()
    spells: tuple[tuple[str, str], ...] = ()  # (name, school)
    leader: bool = False
    caster: str = "No"


@dataclass(frozen=True)
class GroupSpec:
    handle: str
    name: str
    unit_type: str
    race: str | None
    price: int
    stats: Stats
    members: tuple[str, ...]
    items: Kit = ()
    late_member: str = ""  # recruited after the kit was bought, without its last row: a member with a gap
    large: bool = False


@dataclass(frozen=True)
class HireSpec:
    handle: str
    book_name: str
    name: str


@dataclass(frozen=True)
class WarbandSpec:
    player: str
    type_slug: str
    name: str
    backstory: str
    dice_color: str
    heroes: tuple[HeroSpec, ...]
    groups: tuple[GroupSpec, ...]
    hires: tuple[HireSpec, ...] = ()
    stash: Kit = field(default=())
