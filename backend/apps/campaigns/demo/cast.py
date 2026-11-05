"""Who is in the demo campaign: the players, and the shape of the warbands they raise (warbands.py).

Units are named by a handle ("cap.konrad", a henchman "cap.warriors.1") that the battle plans use. Each hero and
group is hired as a fighter of the warband's template, named by his key ("mercenary-captain"), which gives his type,
race, profile (as the warband's variant has it), skill groups, lores, rules, cost and starting XP, as the hire dialog's
Recruit as does. Items are (name, price paid), bought at the hire; a group's items are bought once per member.
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

Kit = tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class HeroSpec:
    handle: str
    name: str
    fighter_key: str  # the template's hero he is hired as
    items: Kit = ()
    skills: tuple[str, ...] = ()  # learnt before the demo starts
    spells: tuple[tuple[str, str], ...] = ()  # (name, lore)


@dataclass(frozen=True)
class GroupSpec:
    handle: str
    name: str
    fighter_key: str  # the template's henchmen the group is hired as
    members: tuple[str, ...]
    items: Kit = ()
    late_member: str = ""  # recruited after the kit was bought, without its last item: a member with a gap


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
