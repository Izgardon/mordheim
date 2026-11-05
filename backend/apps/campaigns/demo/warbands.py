"""The four demo warbands as their players raise them: heroes and henchmen groups hired from the warband's template
by fighter key, hired swords and stash (cast.py has the shapes). The Black Eagles are Reiklanders, so the template
reads as its Reikland variant: their Marksmen have BS 4."""

from .cast import GroupSpec, HeroSpec, HireSpec, WarbandSpec

CLUB = "Club, Mace or Hammer"

REIKLANDERS = WarbandSpec(
    player="cap",
    type_slug="reiklanders",
    name="The Black Eagles",
    backstory="Sworn to the Elector Count, the Black Eagles came for the crown that fell with the comet and stayed "
    "for the wyrdstone. Captain Adler swears he will bring both home.",
    dice_color="#1f3a93",
    heroes=(
        HeroSpec(
            "cap.konrad",
            "Konrad Adler",
            "mercenary-captain",
            (("Sword", 10), ("Shield", 5), ("Light Armour", 20)),
            ("Strike to Injure",),
        ),
        HeroSpec("cap.dieter", "Dieter Brandt", "champions", (("Halberd", 10), ("Helmet", 10))),
        HeroSpec("cap.ott", "Ott the Red", "champions", (("Sword", 10), ("Bow", 10))),
        HeroSpec("cap.felix", "Felix Hartmann", "youngbloods", ((CLUB, 3),)),
    ),
    groups=(
        GroupSpec("cap.bowmen", "Reikland Bowmen", "marksmen", ("Hans", "Jorg"), (("Bow", 10),)),
        GroupSpec(
            "cap.warriors",
            "Eagle Guard",
            "warriors",
            ("Bruno", "Lukas"),
            ((CLUB, 3), ("Shield", 5)),
            late_member="Wilhelm",
        ),
    ),
    hires=(HireSpec("cap.grukk", "Ogre Bodyguard", "Grukk"),),
)

ESHIN = WarbandSpec(
    player="snikch",
    type_slug="skaven",
    name="The Gnawing Shadow",
    backstory="Clan Eshin sent Skritt to steal the comet's heart. He has stolen everything else in Mordheim while "
    "he looks for it.",
    dice_color="#4a4a4a",
    heroes=(
        HeroSpec(
            "snikch.skritt", "Skritt Nightclaw", "assassin-adept", (("Fighting Claws", 35),), ("Art of Silent Death",)
        ),
        HeroSpec(
            "snikch.vrask",
            "Vrask the Hidden",
            "eshin-sorcerer",
            (("Sword", 10),),
            spells=(("Warpfire", "Magic of the Horned Rat"),),
        ),
        HeroSpec("snikch.krekk", "Krekk Blackfur", "black-skaven", (("Sword", 10),)),
        HeroSpec("snikch.tisk", "Tisk", "night-runners", (("Sling", 2), ("Dagger", 2))),  # a second dagger
    ),
    groups=(
        GroupSpec(
            "snikch.verminkin",
            "Verminkin Pack",
            "verminkin",
            ("Snik", "Grit", "Skab"),
            ((CLUB, 3),),
            late_member="Twitch",
        ),
        GroupSpec("snikch.rats", "Giant Rats", "giant-rats", ("Gnaw", "Nibble", "Scab")),
    ),
)

UNDEAD = WarbandSpec(
    player="ilsabet",
    type_slug="undead",
    name="The Court of Ashes",
    backstory="Count Ostrava wants the city's dead and the city's crown, in that order. His Necromancer keeps "
    "count of both.",
    dice_color="#6b0f1a",
    heroes=(
        HeroSpec("ilsabet.ostrava", "Count Ostrava", "vampire", (("Sword", 10),), ("Step Aside",)),
        HeroSpec(
            "ilsabet.mortis",
            "Mortis the Pale",
            "necromancer",
            (("Sword", 10),),
            spells=(("Lifestealer", "Necromancy"),),
        ),
        HeroSpec("ilsabet.grub", "Grub", "dregs", ((CLUB, 3),)),
        HeroSpec("ilsabet.hobb", "Hobb", "dregs", (("Bow", 10),)),
    ),
    groups=(
        GroupSpec("ilsabet.zombies", "Shamblers", "zombies", ("Ulf", "Mara", "Old Piet")),
        GroupSpec("ilsabet.ghouls", "Ghouls of the Pit", "ghouls", ("Gnasher", "Sallow")),
    ),
    stash=(("Lantern", 10),),
)

WITCH_HUNTERS = WarbandSpec(
    player="ulric",
    type_slug="witch-hunters",
    name="Ulric's Pyre",
    backstory="Brother Ulric's order burns what the comet touched. The list grows longer every night.",
    dice_color="#b8860b",
    heroes=(
        HeroSpec(
            "ulric.gottfried",
            "Gottfried Asch",
            "witch-hunter-captain",
            (("Sword", 10), ("Pistol", 15)),
            ("Eagle Eyes",),
        ),
        HeroSpec(
            "ulric.albrecht",
            "Father Albrecht",
            "warrior-priest",
            ((CLUB, 3), ("Light Armour", 20)),
            spells=(("Soulfire", "Prayers of Sigmar"),),
        ),
        HeroSpec("ulric.hanna", "Hanna Brenner", "witch-hunters", (("Sword", 10),)),
        HeroSpec("ulric.jakob", "Jakob Strauss", "witch-hunters", (("Axe", 5),)),
    ),
    groups=(
        GroupSpec(
            "ulric.zealots",
            "Zealots of the Flame",
            "zealots",
            ("Matthias", "Greta", "Udo"),
            ((CLUB, 3),),
            late_member="Lene",
        ),
        GroupSpec("ulric.flagellants", "Penitents", "flagellants", ("Konstantin", "Erich"), (("Flail", 15),)),
    ),
    hires=(HireSpec("ulric.pip", "Halfling Scout", "Pip Underhill"),),
)

WARBANDS = (REIKLANDERS, ESHIN, UNDEAD, WITCH_HUNTERS)
