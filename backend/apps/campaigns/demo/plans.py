"""What happens in each demo battle: who fights, who wins, the kills round by round, who else went out of action,
the injury dice, exploration, finds and the advances taken. Units are cast handles; a neutral creature is
"neutral:<its key>" (the first group's are n1-1, n1-2, ...). Injury dice are a d66's two dice for heroes and one d6
for everyone else. A unit's level-ups are spent on its `advances` in order, else on the default advance for its kind.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Kill:
    killer: str
    victim: str
    how: str = "melee"


@dataclass
class BattlePlan:
    scenario: str
    players: tuple[str, ...]  # the creator first; the last one to finish confirms the results
    winners: tuple[str, ...]
    rounds: tuple[tuple[Kill, ...], ...]
    out_of_action: tuple[str, ...] = ()  # taken out without a kill on record
    injuries: dict[str, tuple[int, ...]] = field(default_factory=dict)
    exploration: dict[str, tuple[int, ...]] = field(default_factory=dict)  # dice, as many as the server suggests
    finds: dict[str, tuple[int, tuple[str, ...]]] = field(default_factory=dict)  # player: (gold, item names)
    advances: dict[str, tuple[str, ...]] = field(default_factory=dict)
    picks: dict[str, str] = field(default_factory=dict)  # a hero's Skill advance picked from his card: the skill
    neutrals: tuple[tuple[str, str, int], ...] = ()  # (group name, creature type, how many)
    ratings: dict[str, int] = field(default_factory=dict)


FIRST_LIGHT = BattlePlan(
    scenario="Skirmish",
    players=("cap", "snikch"),
    winners=("cap",),
    rounds=(
        (Kill("cap.ott", "snikch.tisk", "shooting"), Kill("snikch.skritt", "cap.warriors.1")),
        (Kill("cap.warriors.2", "snikch.krekk"), Kill("cap.ott", "snikch.verminkin.1", "shooting")),
    ),
    injuries={"snikch.tisk": (4, 6), "snikch.krekk": (3, 3), "snikch.verminkin.1": (4,), "cap.warriors.1": (5,)},
    exploration={"cap": (3, 5, 6, 2), "snikch": (1, 4, 4)},
    finds={"cap": (12, ("Lantern",))},
    advances={"cap.ott": ("BS",)},
)

GRAVE_HUNT = BattlePlan(
    scenario="Wyrdstone Hunt",
    players=("ilsabet", "ulric"),
    winners=("ilsabet",),
    neutrals=(("Carrion Swarm", "Giant Rat", 2),),
    rounds=(
        (Kill("ulric.gottfried", "neutral:n1-1", "shooting"), Kill("ilsabet.ostrava", "ulric.albrecht")),
        (Kill("ulric.zealots.1", "ilsabet.grub"), Kill("ilsabet.ghouls.1", "ulric.zealots.2")),
        (Kill("ilsabet.ostrava", "ulric.flagellants.1"),),
    ),
    injuries={
        "ulric.albrecht": (1, 3),
        "ulric.zealots.2": (1,),
        "ulric.flagellants.1": (5,),
        "ilsabet.grub": (3, 2),
    },
    exploration={"ilsabet": (6, 6, 2, 5), "ulric": (2, 3)},
    advances={"ilsabet.ostrava": ("Skill",)},
    picks={"ilsabet.ostrava": "Mighty Blow"},
)

THE_PIT = BattlePlan(
    scenario="Street Fight",
    players=("cap", "ilsabet"),
    winners=("ilsabet",),
    rounds=(
        (Kill("cap.konrad", "ilsabet.mortis"),),
        (Kill("ilsabet.ostrava", "cap.grukk"), Kill("ilsabet.zombies.1", "cap.felix")),
        (Kill("ilsabet.ostrava", "cap.konrad"),),
    ),
    injuries={"cap.konrad": (6, 4), "cap.grukk": (3,), "cap.felix": (5, 1), "ilsabet.mortis": (4, 2)},
    exploration={"cap": (4, 1), "ilsabet": (5, 5, 3)},
    finds={"cap": (10, ())},
    advances={"ilsabet.ostrava": ("A",)},
)

AMBUSH = BattlePlan(
    scenario="Chance Encounter",
    players=("snikch", "ulric"),
    winners=("snikch",),
    ratings={"snikch": 118, "ulric": 152},
    rounds=(
        (Kill("snikch.skritt", "ulric.hanna"), Kill("ulric.pip", "snikch.rats.1", "shooting")),
        (Kill("snikch.verminkin.2", "ulric.jakob"), Kill("ulric.gottfried", "snikch.vrask", "shooting")),
    ),
    injuries={"ulric.hanna": (6, 2), "ulric.jakob": (4, 4), "snikch.rats.1": (2,), "snikch.vrask": (5, 3)},
    exploration={"snikch": (2, 2, 6, 3), "ulric": (5,)},
    finds={"snikch": (8, ())},
    advances={"snikch.skritt": ("WS",)},
)

THE_SQUARE = BattlePlan(
    scenario="Occupy",
    players=("ulric", "cap"),
    winners=("cap",),
    rounds=(
        (Kill("cap.bowmen.1", "ulric.zealots.3", "shooting"), Kill("ulric.gottfried", "cap.ott", "shooting")),
        (Kill("cap.bowmen.1", "ulric.flagellants.2", "shooting"), Kill("cap.dieter", "ulric.zealots.1")),
    ),
    out_of_action=("ulric.pip",),
    injuries={"ulric.zealots.3": (4,), "ulric.flagellants.2": (6,), "ulric.zealots.1": (3,), "ulric.pip": (5,)}
    | {"cap.ott": (4, 1)},
    exploration={"cap": (6, 3, 3), "ulric": (1, 2)},
    finds={"cap": (35, ())},
)

HIDDEN_HOARD = BattlePlan(
    scenario="Hidden Treasure",
    players=("snikch", "ilsabet"),
    winners=("snikch",),
    rounds=(
        (Kill("snikch.skritt", "ilsabet.zombies.2"), Kill("ilsabet.ghouls.2", "snikch.verminkin.3")),
        (Kill("snikch.skritt", "ilsabet.ostrava"),),
    ),
    out_of_action=("snikch.tisk",),
    injuries={"ilsabet.ostrava": (6, 4), "ilsabet.zombies.2": (1,), "snikch.verminkin.3": (6,), "snikch.tisk": (5, 5)},
    exploration={"snikch": (4, 4, 5, 1), "ilsabet": (3, 6)},
    finds={"ilsabet": (5, ())},
    advances={"snikch.skritt": ("Skill",)},  # left for him to choose: "Skill to choose" on his card
)

# In the order they are played; the bounties and the trade happen between them (build.py).
BATTLES = (FIRST_LIGHT, GRAVE_HUNT, THE_PIT, AMBUSH, THE_SQUARE, HIDDEN_HOARD)
