"""William's settled answers for the warband templates (the templates plan, version 5.2, and the phase 1b brief, 4 Nov
2026), as data the import reads: change them here and rebuild. Keys are the snapshot's page slugs
(`sources/testwarbands-2026-10-31/warbands/<page>.json`) and its fighters' names."""

from typing import Any

# Pages that serve several of our types, each type with the variant it presets ("": the player picks one).
# Mercenaries: all four Mercenary types; Tileans: all four Tilean types; Norse: TC13 only (BTB's waits for its PDF).
TEMPLATE_TYPES: dict[str, dict[str, str]] = {
    "mercenaries": {
        "reiklanders": "reikland",
        "middenheimers": "middenheim",
        "marienburgers": "marienburg",
        "ostermarkers": "",
    },
    "tileans": {"miragleans": "miragliano", "remasens": "remas", "trantios": "trantio", "tileans": ""},
    "norse": {"norse-explorers-tc13": ""},
}

# Each page's variants in order: key, name, the snapshot's skill-table subfaction and its rule heading.
VARIANTS: dict[str, list[dict[str, str]]] = {
    "mercenaries": [
        {"key": "reikland", "name": "Reikland", "subfaction": "Reikland Mercenaries", "heading": "Reikland"},
        {"key": "middenheim", "name": "Middenheim", "subfaction": "Middenheim Mercenaries", "heading": "Middenheim"},
        {"key": "marienburg", "name": "Marienburg", "subfaction": "Marienburg Mercenaries", "heading": "Marienburg"},
    ],
    "tileans": [
        {"key": "miragliano", "name": "Miragliano", "subfaction": "Miragleans", "heading": "Miragleans"},
        {"key": "remas", "name": "Remas", "subfaction": "Remasens", "heading": "Remasens"},
        {"key": "trantio", "name": "Trantio", "subfaction": "Trantios", "heading": "Trantios"},
    ],
    "marauders-of-chaos": [
        {"key": "norse", "name": "The Norse", "subfaction": "The Norse", "heading": "The Norse"},
        {"key": "kurgan", "name": "The Kurgan", "subfaction": "The Kurgan", "heading": "The Kurgan"},
        {"key": "hung", "name": "The Hung", "subfaction": "The Hung", "heading": "The Hung"},
    ],
}
# A rule heading that is no variant of the page but one of its warband types (William, 4 Nov 2026: take
# recommendations): the Ostermarkers' rules are for the ostermarkers type, whichever skill table they pick
RULE_TYPES: dict[str, dict[str, str]] = {"mercenaries": {"Ostermark": "ostermarkers"}}

# A variant's rule that changes a number, as data (William, 4 Nov 2026: take recommendations). Each fighter's profile
# change by page, variant and fighter, added to his stat (a written value keeps what follows its number) ...
VARIANT_STATS: dict[str, dict[str, dict[str, dict[str, int]]]] = {
    "mercenaries": {
        "reikland": {"Marksman": {"ballistic_skill": 1}},  # "All Marksmen therefore add +1 to their Ballistic Skill"
        "middenheim": {"Mercenary Captain": {"strength": 1}, "Champion": {"strength": 1}},  # "Strength 4 instead of 3"
    },
    "tileans": {  # "The leadership value of a Remasen captain, champion and young blood are always one point higher"
        "remas": {"Captain": {"leadership": 1}, "Champion": {"leadership": 1}, "Youngblood": {"leadership": 1}},
    },
}
# ... a fighter's most in a variant (None: any number) ...
VARIANT_COUNTS: dict[str, dict[str, dict[str, int | None]]] = {
    "marauders-of-chaos": {"kurgan": {"Warhound of Chaos": None}},  # "any number of Warhounds of Chaos"
}
# ... and a variant's own starting gold, most warriors and bonus to find rare items (phase 3: the store's rare search
# starts there; `rare_bonus_except`, the items it leaves alone, by name)
VARIANT_TERMS: dict[str, dict[str, dict[str, object]]] = {
    "mercenaries": {
        # "an extra 100 gold crowns (600 in total)"; "a +1 bonus when attempting to find rare items"
        "marienburg": {"starting_gold": 600, "rare_bonus": 1},
    },
    "marauders-of-chaos": {
        "norse": {"rare_bonus": 1},  # "a +1 to their rarity rolls when searching during the post-game sequence"
        # "suffers –1 when rolling to find Rare items except for Great Axes and Barbed Whips"
        "kurgan": {"rare_bonus": -1, "rare_bonus_except": ["Great Axe", "Barbed Whip"]},
        "hung": {"max_models": 12},  # "The maximum number of warriors in the warband is 12"
    },
}
# A list line only one variant has (phase 3): page -> (variant, list key, item, list price). The Kurgan's "Heroes and
# Chaos Marauder Henchmen may use bows (cost: 10 gold crowns, availability: common)", on the lists they buy from; the
# Hung's "Warhorses always cost 40 gold crowns to the warband", on the heroes' list, since "all Heroes ...
# automatically have the Ride Warhorse skill"
VARIANT_LINES: dict[str, list[tuple[str, str, str, int]]] = {
    "marauders-of-chaos": [
        ("kurgan", "hero-equipment-list", "Bow", 10),
        ("kurgan", "henchmen-equipment-list", "Bow", 10),
        ("hung", "hero-equipment-list", "Warhorse", 40),
    ],
}
# A book line that only one variant may buy (the review, William, 5 Nov 2026: W11): page -> (variant, list key, our
# item). The Mercenaries' Wolfcloak is on the list the three cities share, but the item names the Middenheimers alone
# of the Mercenaries (its price is "the expense of traveling to Middenheim and taking part in a hunt")
VARIANT_ONLY: dict[str, list[tuple[str, str, str]]] = {
    "mercenaries": [("middenheim", "mercenary-equipment", "Wolfcloak")],
}
# Skills a variant gives every hero, by name (phase 3): the Hung's "all Heroes ... automatically have the Ride Warhorse
# skill" is our Ride [Animal] (the mounted rules' Ride skill; the only special named Ride Warhorse is the Merchant
# Caravans' Knights Vanguard's own)
VARIANT_HERO_SKILLS: dict[str, dict[str, list[str]]] = {"marauders-of-chaos": {"hung": ["Ride [Animal]"]}}

# The upgrades bought onto a fighter (phase 3), by page and group, read from each group's text: who may take one (a
# list line's `who`, by fighter key), the most of the group one fighter may have, whether the second and later cost
# double, whether they are bought only when he is recruited, and a price where the book gives none
UPGRADE_TERMS: dict[tuple[str, str], dict[str, Any]] = {
    # "Mutations may be bought for a Mutant or a Possessed warrior only when they are recruited ... one or more
    # mutations ... second and subsequent mutations bought for the same model cost double"
    ("cult-of-the-posessed", "Mutations"): {
        "who": {"fighters": ["the-possessed", "mutants"]},
        "later_double": True,
        "at_recruit": True,
    },
    # "Blessings of Nurgle may be bought for Tainted Ones only when they are recruited ... one or more Blessings ...
    # second and subsequent Blessings cost double"
    ("carnival-of-chaos", "Blessings of Nurgle"): {
        "who": {"fighters": ["tainted-ones"]},
        "later_double": True,
        "at_recruit": True,
    },
    # "A Hero may only have a single Sacred Marking and these may only be bought when you recruit the Hero"
    ("lizardmen", "Sacred markings"): {"who": {"heroes": True}, "max_per_fighter": 1, "at_recruit": True},
    # no price in the book: "Upon being hired Seers choose their Mark"; the leader may choose one through the Eye of
    # the Gods; one Mark each ("their Mark"). No two models may have different Marks: its rule says so, unchecked
    ("marauders-of-chaos", "Mark of the Dark Gods"): {
        "who": {"fighters": ["marauder-chieftain", "seer"]},
        "max_per_fighter": 1,
        "cost": 0,
    },
}
# One upgrade's own `who`, where its text narrows its group's: "(Saurus Only)", "(Skinks only)"
UPGRADE_WHO: dict[tuple[str, str], dict[str, Any]] = {
    ("lizardmen", "Oversized Jaws"): {"fighters": ["saurus-totem-warrior"]},
    ("lizardmen", "Poison Glands"): {"fighters": ["skink-priest", "skink-great-crests"]},
}
# Entries of an upgrade group that are no upgrade but a warband rule, by page: Poisoned Weapons lets Skink Heroes and
# Saurus buy Dark Venom and Black Lotus, and Skink henchmen Reptile Venom; nothing is bought onto a fighter
UPGRADES_AS_RULES: dict[str, frozenset[str]] = {"lizardmen": frozenset({"Poisoned Weapons"})}

# The tailored lists that sell the shared mutations (William, 5 Nov 2026: "having a tailored upgrade section is
# enough"), by page: each a group, what it sells (`family`: every priced shared special of that type, in the list's
# order, less `except`; or `names`), its terms (UPGRADE_TERMS' shape; none given: the page's own group's) and a note
# said with the group. Each upgrade links the shared special at its price; a page's own group of the name keeps its
# upgrades and takes the rest after them. Left out: the hired swords who may take a mutation (the Chaos Centaur, the
# Ungor Trapper: upgrades are for heroes, so a player adds one from Boons & Banes), the Clan Moulder Rat Ogre's
# mutation at hire (a henchman's) and the god families on the Marauders' Marks. `half`: each at half its price,
# rounded up as gold always is (William, 6 Nov 2026: "yes always round up in mordheim for gold"): 35 gc is 18.
MUTANT_SKILL = "With the Mutant skill."
TWISTKIN = "With the Twistkin skill, at half the listed price."
RULEBOOK_MUTATIONS = [
    "Daemon Soul",
    "Great Claw",
    "Cloven Hoofs",
    "Tentacle",
    "Blackblood",
    "Spines",
    "Scorpion Tail",
    "Extra Arm",
    "Hideous",
]
MUTATION_UPGRADES: dict[str, list[dict[str, Any]]] = {
    # the generic list's 15 (Mutiny in Marienburg's extended list of the Cult's) on the Cult's terms
    "cult-of-the-posessed": [{"group": "Mutations", "family": "Mutation"}],
    # its "Mutations" rule: "Any Hero may buy one of the following Mutations when you recruit them": Extra arm,
    # Tentacle, Great Claw, at the Cult's price
    "court-of-the-profane-pleasures": [
        {
            "group": "Mutations",
            "names": ["Extra Arm", "Tentacle", "Great Claw"],
            "terms": {"who": {"heroes": True}, "max_per_fighter": 1, "at_recruit": True},
        }
    ],
    # the Mutant skill, "The Beastman may buy one mutation", in every hero's special skills; no time or doubling is
    # stated
    "beastmen-raiders": [
        {
            "group": "Mutations",
            "family": "Mutation",
            "terms": {"who": {"fighters": ["beastmen-chieftain", "beastmen-shaman", "bestigors", "centigor"]}},
            "note": MUTANT_SKILL,
        }
    ],
    # the Marauders' mutant skill, "may buy one mutation ... Heroes with the Mark of Onogal may choose a Blessing of
    # Nurgle instead ... except the Mark of Nurgle", in every hero's special skills
    "marauders-of-chaos": [
        {
            "group": "Mutations",
            "family": "Mutation",
            "terms": {"who": {"fighters": ["marauder-chieftain", "seer", "champions", "condemned"]}},
            "note": MUTANT_SKILL,
        },
        {
            "group": "Blessings of Nurgle",
            "family": "Blessing of Nurgle",
            "except": ["Mark of Nurgle"],
            "terms": {"who": {"fighters": ["marauder-chieftain", "seer", "champions", "condemned"]}},
            "note": "Mark of Onogal heroes with the Mutant skill, instead of a mutation.",
        },
    ],
    # the Twistkin skill (Stormvermin only, PDF p4): "must buy a Mutation from the list in the Mordheim Rulebook (see
    # Possessed Warband) at half the listed cost", once, when he takes the skill
    "skaven-of-clan-moulder": [
        {
            "group": "Mutations",
            "names": RULEBOOK_MUTATIONS,
            "half": True,
            "terms": {"who": {"fighters": ["stormvermin"]}, "max_per_fighter": 1},
            "note": TWISTKIN,
        }
    ],
}

# Most warriors where the book gives none; their starting gold reads as 500 gc
SIZES: dict[str, int] = {
    "dwarf-rangers": 12,
    "forest-goblins": 20,
    "cursed-cavalcade": 15,
    "gunnery-school-of-nuln": 15,
}

# Titles for the warband rules with none, by page and the rule's place in it (the Tilean ones take their variant's
# name)
RULE_TITLES: dict[tuple[str, int], str] = {
    ("bretonnian", 0): "Blessing of the Lady",
    ("mootlanders", 0): "Weak and Puny",
    ("outlaws-of-stirwood-forest", 0): "Bowmen",
}

# mordheimer's fighter races to ours (None: no race; the creatures that gain no XP come in with none)
RACES: dict[str, str | None] = {
    "human": "Human",
    "elf": "Elf",
    "dwarf": "Dwarf",
    "black dwarf": "Dwarf",
    "ogre": "Ogre",
    "halfling": "Halfling",
    "possessed": "Possessed",
    "ghoul": "Ghoul",
    "saurus": "Saurus",
    "skink": "Skink",
    "goblin": "Goblin",
    "orc": "Orc",
    "black orc": "Black Orc",
    "hobgoblin": "Hobgoblin",
    "marauder of chaos": "Marauder of Chaos",
    "ungor": "Ungor",
    "centigor": "Centigor",
    "other beastmen": "Other Beastmen",
    "beastman": "Other Beastmen",
    "wulfen": "Werecreature",
    "liche priest": "Liche Priest & Acolyte",
    "acolyte": "Liche Priest & Acolyte",
    "liche": "Liche",
    "grave guard": "Grave Guard",
    "tomb lord": "Tomb Lord",
    "tomb guard": "Undead",
    "tomb guardian": "Undead",
    "mummy": "Human",
    "mutant": None,
    "undead": "Undead",
    "skaven": "Skaven",
    "bull centaur": "Bull Centaur",
}
# Fighters mordheimer gives no race, settled (William, 4 Nov 2026: take recommendations): the Beastmen's Minotaur
# takes our Minotaur; the Cursed Cavalcade's fighters stay raceless. The review (William, 5 Nov 2026: W10): the
# Carnival's Brute ("what were once men") and Tainted One (the warband's "mortal members"), "mutant" to mordheimer,
# are Human, as the Cult's Mutants are; the Lizardmen's Kroxigor ("race": "kroxigor") takes our Kroxigor
RACES_BY_FIGHTER: dict[tuple[str, str], str] = {
    ("beastmen-raiders", "Minotaur"): "Minotaur",
    ("carnival-of-chaos", "Brute"): "Human",
    ("carnival-of-chaos", "Tainted One"): "Human",
    ("lizardmen", "Kroxigor"): "Kroxigor",
}
# A warband's own maximum is a race of its own, and the Undead warband's Vampire is our Vampire
RACES_BY_PAGE: dict[tuple[str, str], str] = {
    ("skaven-pestilens", "skaven"): "Skaven (Clan Pestilens)",
    ("black-dwarfs", "bull centaur"): "Bull Centaur (Black Dwarfs)",
    ("the-sons-of-hashut", "bull centaur"): "Bull Centaur (Sons of Hashut)",
    ("undead", "undead"): "Vampire",
    ("halflings", "ogre"): "Ogre (Halflings)",  # the Halflings PDF's Ogre maximum (p1), unlike our Ogre's
}
CREATURES = frozenset(
    {
        "animal",
        "bear",
        "chaos hound",
        "chaos spawn",
        "cold one beasthound",
        "construct",
        "daemon",
        "giant rat",
        "hawk",
        "kroxigor",
        "monkey",
        "rat ogre",
        "sabretusk",
        "scorpion",
        "skeleton",
        "snotling",
        "squig",
        "stone golem",
        "tomb scorpion",
        "troll",
        "warhound",
        "wolf",
    }
)

# Casters magic.json gives no lore, settled (William): page, fighter -> lore
CASTERS: dict[tuple[str, str], str] = {
    ("court-of-the-profane-pleasures", "Slaaneshi Priest of Obscene"): "Chaos Rituals",
    ("merchant-caravans", "Magician"): "Lesser Magic",
    ("tomb-guardians-old", "Liche Priest"): "Mortuary Cult Scrolls",
}
MAGIC_WARBANDS: dict[str, str] = {"Ostlanders": "ostlander"}  # magic.json's warband names that aren't a page's
LORES: dict[str, str] = {  # magic.json's lore names that differ from our spells' lores by more than punctuation
    "Charms & Hexes": "Charms and Hexes",
    "Lizardman Magic": "Lizardmen Magic",
    "Necromancy (The Restless Dead)": "Necromancy (Restless Dead)",
}
# The Special tick names the warband's skill group (out/skill-groups.json), per hero where the book splits them (the
# brief's table). The report checks each name is a group whose learners include the template's types.
CORE_SKILLS = (
    ("combat", "Combat"),
    ("shooting", "Shooting"),
    ("academic", "Academic"),
    ("strength", "Strength"),
    ("speed", "Speed"),
)
SPECIAL_GROUPS: dict[str, list[str]] = {
    "arabian-tomb-raiders": ["Tomb Robbers"],
    "battle-monks-of-cathay": ["Battle Monks of Cathay"],
    "beastmen-raiders": ["Beastmen Raiders"],
    "black-orcs": ["Orcs"],
    "orc-mob": ["Orcs"],
    "bretonnian": ["Bretonnian Knights"],
    "bretonnian-chapel-guard": ["Bretonnian Chapel Guard"],
    "forest-goblins": ["Forest Goblins"],
    "hochland-bandits": ["Hochland Bandits"],
    "maneaters": ["Ogres"],
    "marauders-of-chaos": ["Marauders of Chaos"],
    "norse": ["Norse"],
    "sisters-of-sigmar": ["Sisters of Sigmar"],
    "the-restless-dead": ["Restless Dead Lich and Necromancer"],
    "black-dwarfs": ["Black Dwarfs"],
    "the-sons-of-hashut": ["Sons of Hashut"],
    "dark-elves": ["Dark Elf"],
    "dwarf-treasure-hunters": ["Dwarves"],
    "dwarf-rangers": ["Dwarf Rangers"],
    "pit-fighters": ["Pit Fighters"],
    "pit-fighters-old": ["Pit Fighters"],
    "horned-hunters": ["Horned Hunters"],
    "lizardmen": ["Skink"],
    "night-goblins-web": ["Night Goblins"],
    "night-goblins": ["Night Goblins (MIC)"],  # night-goblins-mic's, as skill groups named it
    "ostlander": ["Ostlanders"],
    "pirates": ["Pirates", "Pirates (TBMF)"],
    "shadow-warriors": ["Shadow Warriors"],
    "skaven-eshin": ["Skaven"],
    "skaven-pestilens": ["Skaven Clan Pestilens"],
    "amazons-lustria": ["Amazons"],  # one group for both Amazons types (skill groups, phase 1a)
    "merchant-caravans": ["Merchant Caravans"],
    "cursed-cavalcade": ["Cursed Cavalcade"],
}
SPECIAL_GROUPS_BY_FIGHTER: dict[tuple[str, str], list[str]] = {
    ("dwarf-treasure-hunters", "Dwarf Troll Slayer"): ["Dwarf Troll Slayers"],
    ("dwarf-rangers", "Dwarf Troll Slayers"): ["Dwarf Troll Slayers"],
    ("pit-fighters", "Dwarf Troll Slayer"): ["Dwarf Troll Slayers"],
    ("pit-fighters-old", "Dwarf Troll Slayer"): ["Dwarf Troll Slayers"],
    ("lizardmen", "Saurus Totem Warrior"): ["Saurus"],
}
SPECIAL_ADDED: dict[str, list[str]] = {"black-dwarfs": ["Bull Centaur"]}  # mordheimer leaves its tick off

# The Pit Fighters (William, question 28): two warband notes give the styles; four plain lists at usual prices
PIT_FIGHTERS = "pit-fighters"
STYLE_NOTES = (
    ("pit-fighter-equipment-list", "Pit Fighter fighting styles"),
    ("pursuer-equipment-list", "Pursuer fighting styles"),
)
STYLES_AFTER = "Weapons & Armour"  # the notes follow the rule that introduces the styles
PIT_FIGHTER_LISTS: list[dict[str, object]] = [
    {
        "key": "pit-fighter",
        "name": "Pit fighter",
        "fighters": ["Pit King", "Pit Veteran", "Pit Fighter"],
        "lines": [
            ("dagger", "1st free"),
            ("axe", 5),
            ("shield", 5),
            ("helmet", 10),
            ("sword", 10),
            ("spiked gauntlet", 15),
            ("flail", 15),
            ("double-handed weapon", 15),
            ("light armour", 20),
        ],
    },
    {
        "key": "pursuer",
        "name": "Pursuer",
        "fighters": ["Pursuer"],
        "lines": [
            ("dagger", "1st free"),
            ("javelins", 5),
            ("net", 5),
            ("buckler", 5),
            ("helmet", 10),
            ("sword", 10),
            ("spear", 10),
            ("trident", 15),
        ],
    },
    {
        "key": "ogre",
        "name": "Ogre",
        "fighters": ["Ogre Pit Fighter"],
        "lines": [
            ("dagger", "1st free"),
            ("mace", 3),
            ("hammer", 3),
            ("axe", 5),
            ("sword", 10),
            ("helmet", 10),
            ("flail", 15),
            ("spiked gauntlet", 15),
            ("light armour", 20),
        ],
    },
    {
        "key": "troll-slayer",
        "name": "Troll Slayer",
        "fighters": ["Dwarf Troll Slayer"],
        "lines": [
            ("dagger", "1st free"),
            ("mace", 3),
            ("hammer", 3),
            ("axe", 5),
            ("sword", 10),
            ("dwarf axe", 15),
            ("flail", 15),
            ("spiked gauntlet", 15),
            ("gromril weapon", "3 × price"),
        ],
    },
]

# Special equipment named apart from our item ("Firepots" is our "Firepots Miragliano")
SPECIAL_EQUIPMENT_ITEMS: dict[tuple[str, str], str] = {("lustrian-reavers", "Firepots"): "Firepots Miragliano"}

# What the book says that the data can't hold yet: listed in the report until William settles each
NOT_APPLIED = [
    "Applied as data: Reikland's Marksmen BS +1, Middenheim's Mercenary Captain and Champions S +1 (S4), Remas'"
    " Captain, Champions and Youngbloods Ld +1, Marienburg's 600 gc, the Hung's 12 warriors and the Kurgan's"
    " any number of warhounds; the Ostermarkers' rules are for their type.",
    "Applied as data (phase 3): Marienburg's and the Norse' +1 and the Kurgan's -1 to find rare items (not for Great"
    " Axes and Barbed Whips), where the store's rare search starts its bonus; the Kurgan's 10 gc bows on the heroes'"
    " and henchmen's lists and the Hung's 40 gc warhorses on the heroes' list, for that variant only; Ride [Animal]"
    " for every Hung hero.",
    "Not applied (rules the data can't hold): Trantio's extra 100 gc in a one-off game and 20% in a Lustrian"
    " campaign (it depends on the campaign), Miragliano's +1 to hit with crossbows (heroes) and missiles (Marksmen),"
    " Remas' rout re-roll against Dark Elves, a Hung henchman who becomes a hero getting Ride Warhorse, and the"
    " Ostermarker captain's starting wardog.",
    "Mercenaries: the Ostermarkers pick one of the three cities' skill tables.",
]
