"""What the e2e campaign's battles are: two played out, and three parked, one at each stage a test needs.

The dice are chosen so nobody dies (a henchman's d6 is 3-6, a hero's d66 lands in Full Recovery), because a death
would change the rosters a test asserts on. The plans are `demo/plans.py`'s shape, played by `demo/battles.py`.
"""

from apps.campaigns.demo.plans import BattlePlan, Kill

FIRST_SKIRMISH = BattlePlan(
    scenario="Skirmish",
    players=("owner", "player"),
    winners=("owner",),
    rounds=(
        (Kill("owner.bowmen.1", "player.zealots.1", "shooting"), Kill("player.captain", "owner.guard.1")),
        (Kill("owner.captain", "player.hunter"),),
    ),
    injuries={"player.zealots.1": (4,), "owner.guard.1": (5,), "player.hunter": (4, 3)},
    exploration={"owner": (3, 5, 6, 2), "player": (1, 4, 4, 2)},
    finds={"owner": (20, ("Lantern",))},
)

SECOND_SKIRMISH = BattlePlan(
    scenario="Wyrdstone Hunt",
    players=("player", "owner"),
    winners=("player",),
    rounds=(
        (Kill("player.priest", "owner.young"), Kill("owner.champion", "player.zealots.2")),
        (Kill("player.captain", "owner.bowmen.2", "shooting"),),
    ),
    injuries={"owner.young": (4, 4), "player.zealots.2": (6,), "owner.bowmen.2": (3,)},
    exploration={"owner": (2, 3, 4, 5), "player": (6, 6, 2, 5)},
    finds={"player": (15, ())},
)

# Fought and finished, nobody's post-game finalised: the stage a post-game test opens on.
PARKED_POSTBATTLE = BattlePlan(
    scenario="Street Fight",
    players=("owner", "player"),
    winners=("owner",),
    rounds=((Kill("owner.captain", "player.priest"),),),
    injuries={"player.priest": (4, 4)},
)

# Created, joined and picked, nobody ready: the stage a pre-battle test opens on.
PARKED_PREBATTLE = BattlePlan(scenario="Chance Encounter", players=("owner", "player"), winners=(), rounds=())

# Started, one kill recorded, nobody finished: the stage an active-battle test opens on. A different pair, because
# starting a battle clears its players' other pre-battles (services/one_battle.py).
PARKED_ACTIVE = BattlePlan(
    scenario="Occupy",
    players=("rival", "scavenger"),
    winners=(),
    rounds=((Kill("rival.count", "scav.runner"),),),
)
