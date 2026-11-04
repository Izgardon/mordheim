"""William's settled answers for the warband templates (the templates plan, version 5.2, and the phase 1b brief, 4 Nov
2026), as data the import reads: change them here and rebuild. Keys are the snapshot's page slugs
(`sources/testwarbands-2026-10-31/warbands/<page>.json`) and its fighters' names."""

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
# A rule heading that is no variant of the page: the Ostermarkers' rules, kept under their own key (the Ostermarkers
# pick one of the three skill tables; the report says so)
RULE_HEADINGS: dict[str, dict[str, str]] = {"mercenaries": {"Ostermark": "ostermark"}}

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
    "skink": "Skinks",
    "goblin": "Goblin",
    "orc": "Orc",
    "black orc": "Black Orc",
    "hobgoblin": "Hobgoblin",
    "marauder of chaos": "Marauder of Chaos",
    "ungor": "Ungor",
    "centigor": "Centigors",
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
# A warband's own maximum is a race of its own, and the Undead warband's Vampire is our Vampire
RACES_BY_PAGE: dict[tuple[str, str], str] = {
    ("skaven-pestilens", "skaven"): "Skaven (Clan Pestilens)",
    ("black-dwarfs", "bull centaur"): "Bull Centaur (Black Dwarfs)",
    ("the-sons-of-hashut", "bull centaur"): "Bull Centaur (Sons of Hashut)",
    ("undead", "undead"): "Vampire",
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

# The Special tick names the warband's skill group, per hero where the book splits them (the brief's table). Group
# names marked (new) come with skill groups; night-goblins-mic's is the skill-groups branch's to name.
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
    "night-goblins": ["Night Goblins (Mordheim 1c)"],
    "ostlander": ["Ostlanders"],
    "pirates": ["Pirates", "Pirates (TBMF)"],
    "shadow-warriors": ["Shadow Warriors"],
    "skaven-eshin": ["Skaven"],
    "skaven-pestilens": ["Skaven Clan Pestilens"],
    "amazons-lustria": ["Amazons (Lustria)"],
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
    "Mercenaries: Middenheim's Captain and Champions start with Strength 4 (its rule's text); their profiles keep"
    " mordheimer's S3 until it is settled as a variant change.",
    "Mercenaries: the Ostermarkers pick one of the three cities' skill tables; their own rule is kept under the key"
    " ostermark, which no variant has, so the Warbands page shows it with every city.",
]
