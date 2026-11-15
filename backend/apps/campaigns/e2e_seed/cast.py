"""Who plays in the e2e campaign and what each warband is made of.

Six players, each one state a test needs: `owner` and `player` have fought and have the battles parked on them,
`rival` and `scavenger` are the pair whose battle is left under way, `fresh` has a warband with nothing spent in it
(its gold is the template's starting gold), and `newcomer` has no warband at all, so a test can raise one.

The emails, the password and the join code are the suite's interface: a test signs in with them, so changing one
is changing an API. The warband shapes reuse the demo's specs (`demo/cast.py`).
"""

from apps.campaigns.demo.cast import GroupSpec, HeroSpec, HireSpec, WarbandSpec

CAMPAIGN_NAME = "E2E Shards"
JOIN_CODE = "E2E001"  # fixed, so a join test can type it
PASSWORD = "e2e-password-2026"  # long enough for Django's validators, and never a demo or production password
EMAIL_DOMAIN = "@e2e.mordheim.test"

# handle: (email, display name)
PLAYERS: dict[str, tuple[str, str]] = {
    "owner": (f"owner{EMAIL_DOMAIN}", "Owner Ann"),
    "player": (f"player{EMAIL_DOMAIN}", "Player Bo"),
    "rival": (f"rival{EMAIL_DOMAIN}", "Rival Cal"),
    "scavenger": (f"scavenger{EMAIL_DOMAIN}", "Scav Dee"),
    "fresh": (f"fresh{EMAIL_DOMAIN}", "Fresh Eli"),
    "newcomer": (f"newcomer{EMAIL_DOMAIN}", "New Fay"),
}
OWNER_EMAIL = PLAYERS["owner"][0]

CLUB = "Club, Mace or Hammer"

STEEL_VIGIL = WarbandSpec(
    player="owner",
    type_slug="reiklanders",
    name="Steel Vigil",
    backstory="The owner's warband: heroes, two henchmen groups, a hired sword and a stash, a season into the city.",
    dice_color="#1f3a93",
    heroes=(
        HeroSpec("owner.captain", "Anna Steel", "mercenary-captain", (("Sword", 10), ("Light Armour", 20))),
        HeroSpec("owner.champion", "Bert Vogel", "champions", (("Halberd", 10),)),
        HeroSpec("owner.young", "Cuno Falk", "youngbloods", ((CLUB, 3),)),
    ),
    groups=(
        GroupSpec("owner.bowmen", "Vigil Bowmen", "marksmen", ("Dorn", "Emil"), (("Bow", 10),)),
        GroupSpec("owner.guard", "Vigil Guard", "warriors", ("Falk", "Gerd"), ((CLUB, 3), ("Shield", 5))),
    ),
    hires=(HireSpec("owner.ogre", "Ogre Bodyguard", "Grust"),),
    stash=(("Lantern", 10),),
)

ASH_CHOIR = WarbandSpec(
    player="player",
    type_slug="witch-hunters",
    name="Ash Choir",
    backstory="The owner's regular opponent: the warband on the other side of every battle the seed plays.",
    dice_color="#b8860b",
    heroes=(
        HeroSpec("player.captain", "Hedda Ruhl", "witch-hunter-captain", (("Sword", 10),)),
        HeroSpec("player.priest", "Ivo Kessel", "warrior-priest", ((CLUB, 3),)),
        HeroSpec("player.hunter", "Jorg Lenz", "witch-hunters", (("Axe", 5),)),
    ),
    groups=(GroupSpec("player.zealots", "Ash Zealots", "zealots", ("Kurt", "Lotte"), ((CLUB, 3),)),),
)

GRAVE_TIDE = WarbandSpec(
    player="rival",
    type_slug="undead",
    name="Grave Tide",
    backstory="Half of the pair whose battle the seed leaves under way.",
    dice_color="#6b0f1a",
    heroes=(
        HeroSpec("rival.count", "Count Mara", "vampire", (("Sword", 10),)),
        HeroSpec("rival.dreg", "Nedd", "dregs", ((CLUB, 3),)),
    ),
    groups=(GroupSpec("rival.zombies", "Grave Shamblers", "zombies", ("Olf", "Pita")),),
)

GUTTER_KIN = WarbandSpec(
    player="scavenger",
    type_slug="skaven",
    name="Gutter Kin",
    backstory="The other half of the pair whose battle the seed leaves under way.",
    dice_color="#4a4a4a",
    heroes=(
        HeroSpec("scav.chief", "Qesh Blackfur", "black-skaven", (("Sword", 10),)),
        HeroSpec("scav.runner", "Rikt", "night-runners", (("Sling", 2),)),
    ),
    groups=(GroupSpec("scav.rats", "Gutter Rats", "giant-rats", ("Snag", "Tik")),),
)

# Nothing hired and nothing bought: its gold is its template's starting gold, which a recruit test spends.
PALE_LANTERNS = WarbandSpec(
    player="fresh",
    type_slug="reiklanders",
    name="Pale Lanterns",
    backstory="Raised and not spent: a warband at its template's starting gold, with no unit in it.",
    dice_color="#2e8b57",
    heroes=(),
    groups=(),
)

WARBANDS = (STEEL_VIGIL, ASH_CHOIR, GRAVE_TIDE, GUTTER_KIN, PALE_LANTERNS)
