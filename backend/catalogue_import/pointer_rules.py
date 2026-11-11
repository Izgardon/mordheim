"""Rules whose text only points elsewhere or names a skill he has, and the skills a fighter starts with.

William, 7 Nov 2026, of the Gunnery School of Nuln's Senior Gunnery Officer, whose Hunter read "See Shooting Skills.":
"the unit has the hunter skill and we just reference the skills page, it should just say the rule there!"; asked then
whether such a fighter should start with the actual skill in his skills, the same as one he'd learned (so it shows with
his skills, counts as one he has and follows any change to the skill): "yes please do that".

A warband template fighter's or a dramatis persona's own rule whose whole text is a pointer to a skill ("See Shooting
Skills.", "See Strength Skill section.", "As the skill of the same name.", "A Pit King has the Pit Fighter skill.")
becomes our skill of the rule's name in his `skills` (the Pit Fighters' Arms Master is ours too), and the rule goes.
A rule that says he has a skill in other words is William's call, written out below (`STARTS_WITH`): it goes the same
way, and one that says more than the skill (a mount in his cost, a choice, more he can do) keeps its text while he
starts with the skill too (`ALSO_STARTS_WITH`). A rule that leaves the player a choice ("each Trapper starts with one
of ...") stays a rule, as the app can't pick for him. A pointer to another fighter's entry ("See Goblin Warriors entry
for rules.") takes that fighter's rule of the name, which the fighter then holds (one row in the template). A text
that says more than the pointer, or points to a list of choices ("See the Mutations list for costs"), is left alone;
one we can't resolve stays as it is, listed in the report. The hired swords' rules and skills are our own data
(apps/hirelings/data/hired-swords.json), worded there.
"""

import re
from dataclasses import dataclass, field
from typing import Any

SKILL_POINTER = re.compile(
    r"^(?:see (?:the )?[\w' -]*?\bskills?(?: section| list)?|as the skill of the same name)\.?$", re.I
)
ENTRY_POINTER = re.compile(r"^see (?:the )?(?P<fighter>[\w' -]+?) entry(?: for (?:its |the )?rules)?\.?$", re.I)
HAS_SKILL = re.compile(r"^[\w' -]+? (?:has|have) the (?P<skill>[\w' -]+?) skill\.?$", re.I)  # "A Pit King has the ..."
OWNER_SUFFIX = re.compile(r"\s*\([^)]*\)$")  # "Not Orcs (Cave Squig)": the rule's name for one fighter

# A rule that only says he has, starts with or rides with one of our skills: template -> fighter -> the rule's name
# (less a fighter's suffix) -> our skills; the rule goes. Ride Warhorse, Ride: Horse, Ride (Nightmare), Ride Giant
# Spiders and the Blazing Saddles' Ride are our Ride [Animal], as the Hung's Ride Warhorse is; Animal Handling and
# Animal Handler: Horse and Warhorse our [Animal] Handler.
STARTS_WITH: dict[str, dict[str, dict[str, list[str]]]] = {
    "Battle Monks of Cathay": {"Emissary": {"Ride Horse": ["Ride [Animal]"]}},  # "trained in riding Horses"
    # "A Questing Knight starts with the skill Ride Warhorse."
    "Bretonnian Chapel Guard": {"Questing Knight": {"Ride": ["Ride [Animal]"]}},
    # "Brutes start the game with the Strongman skill from the Strength skill list"
    "Carnival of Chaos": {"Brute": {"Unnatural Strength": ["Strongman"]}},
    # "The Chieftain can ride Giant Spiders and the Gigantic Spider as detailed in the 'Blazing Saddles' article"
    "Forest Goblins": {"Chieftain": {"Ride Spiders": ["Ride [Animal]"]}},
    # "Marksmen have the Hunter skill from the Mordheim rulebook. A Marksman who becomes a Hero gains no further effect
    # from taking the Hunter skill": he has it, so he can't take it again
    "Gunnery School of Nuln": {"Marksmen": {"Quick Reload": ["Hunter"]}},
    "Imperial Outriders": {  # "The Knight has the Ride skill as detailed in the Blazing Saddles article."
        "Knight": {"Ride": ["Ride [Animal]"]},
        "Outrider": {"Ride": ["Ride [Animal]"]},
        "Scout": {"Ride": ["Ride [Animal]"]},
        "Chasseur": {"Ride": ["Ride [Animal]"]},
        "Hussar": {"Ride": ["Ride [Animal]"], "Combat Riding": ["Combat Riding"]},
        "Groom": {"Ride": ["Ride [Animal]"], "Horse Handling": ["[Animal] Handler"]},  # "the Animal Handling skill"
    },
    # "A Squire starts with the skills Ride: Horse and Animal Handler: Horse and Warhorse."
    "Knights of the Bitter Moors": {"Squire": {"Starting Skills": ["Ride [Animal]", "[Animal] Handler"]}},
    "Merchant Caravans": {"Knights Vanguard": {"Ride Warhorse": ["Ride [Animal]"]}},  # "trained in riding Warhorses"
    # "Thieves may infiltrate, as the Infiltration skill: ..." (the skill's rule, retold)
    "Militant Mootlanders": {"Thief": {"Infiltration": ["Infiltration"]}},
    "Nipponese Expedition": {  # "The Hatamoto has the Ride skill of the Blazing Saddles rules."
        "Hatamoto": {"Ride": ["Ride [Animal]"]},
        "Retainer": {"Ride": ["Ride [Animal]"]},
    },
    "The Cursed Cavalcade": {
        "Aristocrat": {"Expert Horseman": ["Ride [Animal]"]},  # "the Aristocrat has the Ride (Nightmare) skill."
        "Companion": {"Expert Swordsman": ["Expert Swordsman"]},  # "Companions all have Expert Swordsman Skill."
    },
}
# A rule that says he has one of our skills and more: he starts with the skills and the rule keeps its text.
ALSO_STARTS_WITH: dict[str, dict[str, dict[str, list[str]]]] = {
    # "The Ogre Hunter has the Sabre Trainer skill: when a Sabretusk Cub ... you may move it 3D6" towards any model
    # within 12" of it that it can see, instead of the nearest" (William, 11 Nov 2026: it says more, so it keeps it)
    "Ogre Hunting Party": {"Ogre Hunter": {"Sabre Trainer": ["Sabre Trainer"]}},
    # "A Sergeant has the animal handling skill Falconer, so he may use a hunting bird."
    "Watchmen": {"Sergeant": {"Falconer": ["Falconer"]}},
    "Knights of the Bitter Moors": {
        # "A Knight has the Ride skill for a horse or a warhorse (Blazing Saddles). He comes with his mount in his
        # cost"
        "Questing Knight": {"Ride": ["Ride [Animal]"]},
        "Knight Errant": {"Ride": ["Ride [Animal]"]},
        # "Mounted Yeomen come with riding horses, in their cost, and the skill Ride: Horse. If a Yeoman's horse is
        # killed, it must be bought again"
        "Mounted Yeoman": {"Mounted or Nothin'": ["Ride [Animal]"]},
    },
    # "The Packmaster may goad ... He starts ... with the Ride Wolf Rat skill and one more Beast Handling skill" (his
    # choice)
    "Skaven of Clan Moulder": {"Packmaster": {"Master Handler": ["Ride [Animal]"]}},
    # "The Fighting Ape has the Scale Sheer Surfaces Skill, Acrobat Skill, and Dodge Skill. In addition, the Fighting
    # Ape can make a diving charge from up to 10" high."
    "The Cursed Cavalcade": {"Fighting Ape": {"Agile": ["Scale Sheer Surfaces", "Acrobat", "Dodge"]}},
}
# The same for a dramatis persona: name -> rule -> our skills, the rule keeping its text ("Note that Ippan Shu also
# has the Dodge skill.", in his Parry Missiles)
PERSONAE_ALSO_START_WITH: dict[str, dict[str, list[str]]] = {
    "Grand Master Ippan Shu": {"Parry Missiles": ["Dodge"]},
}


def points_to_skill(name: str, text: str) -> bool:
    """A rule's whole text is a pointer to the skill of its name: "See Shooting Skills.", "As the skill of the same
    name.", "A Pit King has the Pit Fighter skill."."""
    named = HAS_SKILL.match(text)
    return bool(SKILL_POINTER.match(text)) or (
        named is not None and named.group("skill").casefold() == _base(name).casefold()
    )


@dataclass
class PointerLog:
    skills: list[tuple[str, str, str, bool]] = field(default_factory=list)  # owner, rule, skills, the rule kept
    entries: list[tuple[str, str, str]] = field(default_factory=list)  # owner, rule, the entry's rule it took
    unresolved: list[tuple[str, str, str]] = field(default_factory=list)  # owner, rule, its pointer


def _base(name: str) -> str:
    return OWNER_SUFFIX.sub("", name).strip()


class Skills:
    """Our skills by name in any case; a skill a fighter starts with goes in under our name."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.names = {str(row["name"]).casefold(): str(row["name"]) for row in rows}

    def ours(self, name: str) -> str | None:
        return self.names.get(name.casefold())

    def named(self, names: list[str], owner: str) -> list[str]:
        """William's skills for a rule, as ours; a name we lack stops the build."""
        missing = [name for name in names if self.ours(name) is None]
        if missing:
            raise ValueError(f"pointer_rules.py: {owner} starts with skills we don't have: {', '.join(missing)}")
        return [str(self.ours(name)) for name in names]


def _give(owner: dict[str, Any], names: list[str]) -> None:
    """The skills into his starting skills, each once."""
    held = owner.setdefault("skills", [])
    held += [name for name in names if name not in held]


def _answers(template: dict[str, Any], fighter: dict[str, Any]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    gone = STARTS_WITH.get(template["name"], {}).get(fighter["name"], {})
    kept = ALSO_STARTS_WITH.get(template["name"], {}).get(fighter["name"], {})
    return gone, kept


def _entry_rule(template: dict[str, Any], fighter: str, name: str) -> dict[str, Any] | None:
    """The rule of the name (less its fighter's suffix) on the fighter an entry pointer names, by name or plural."""
    wanted = fighter.casefold()
    for other in template["fighters"]:
        if wanted in (other["name"].casefold(), str(other.get("plural") or "").casefold()):
            for special in other["specials"]:
                if _base(special["name"]) == _base(name) and "description" in special:
                    found: dict[str, Any] = special
                    return found
    return None


def _skill_pointer(special: dict[str, Any], skills: Skills, log: PointerLog, owner: str) -> list[str] | None:
    """The skill a pointer rule names, as ours (None: no skill of the name, left pointing and reported)."""
    text = str(special.get("description") or "").strip()
    found = skills.ours(_base(special["name"]))
    if found is None:
        log.unresolved.append((owner, special["name"], text))
        return None
    return [found]


def _fighter_rules(template: dict[str, Any], fighter: dict[str, Any], skills: Skills, log: PointerLog) -> None:
    owner = f"{template['name']}: {fighter['name']}"
    gone, kept = _answers(template, fighter)
    unmet = {*gone, *kept} - {_base(special["name"]) for special in fighter["specials"]}
    if unmet:
        raise ValueError(f"pointer_rules.py: {owner} has no rule {', '.join(sorted(unmet))}")
    rules: list[dict[str, Any]] = []
    for special in fighter["specials"]:
        text = str(special.get("description") or "").strip()
        name = _base(special["name"])
        given = skills.named(gone[name], owner) if name in gone else None
        if given is None and points_to_skill(special["name"], text):
            given = _skill_pointer(special, skills, log, owner)
        if given is not None:
            _give(fighter, given)
            log.skills.append((owner, special["name"], ", ".join(given), False))
            continue
        if name in kept:
            also = skills.named(kept[name], owner)
            _give(fighter, also)
            log.skills.append((owner, special["name"], ", ".join(also), True))
        elif (entry := ENTRY_POINTER.match(text)) is not None:
            target = _entry_rule(template, entry.group("fighter"), special["name"])
            if target is None:
                log.unresolved.append((owner, special["name"], text))
            else:
                log.entries.append((owner, special["name"], f"the {entry.group('fighter')} entry's {target['name']}"))
                special = dict(target)
        if special["name"] not in [rule["name"] for rule in rules]:
            rules.append(special)
    fighter["specials"] = rules


def check_answers(templates: list[dict[str, Any]], personae: list[dict[str, Any]]) -> None:
    """Every template, fighter and persona William's answers name is one the build has (a renamed one stops it)."""
    fighters = {(template["name"], fighter["name"]) for template in templates for fighter in template["fighters"]}
    named = {(name, fighter) for table in (STARTS_WITH, ALSO_STARTS_WITH) for name in table for fighter in table[name]}
    missing = [f"{name}: {fighter}" for name, fighter in sorted(named - fighters)]
    missing += sorted(set(PERSONAE_ALSO_START_WITH) - {persona["name"] for persona in personae})
    if missing:
        raise ValueError(f"pointer_rules.py names fighters the build lacks: {'; '.join(missing)}")


def resolve_pointers(
    templates: list[dict[str, Any]], personae: list[dict[str, Any]], rows: list[dict[str, Any]]
) -> PointerLog:
    """Every template fighter's and dramatis persona's pointer rule given the skill or rule it points to, and the
    skills William's answers give, in place."""
    skills = Skills(rows)
    log = PointerLog()
    for template in templates:
        for fighter in template["fighters"]:
            fighter.setdefault("skills", [])
            _fighter_rules(template, fighter, skills, log)
    for persona in personae:
        _persona_rules(persona, skills, log)
    return log


def _persona_rules(persona: dict[str, Any], skills: Skills, log: PointerLog) -> None:
    kept = PERSONAE_ALSO_START_WITH.get(persona["name"], {})
    unmet = set(kept) - {special.get("name") for special in persona.get("specials") or [] if isinstance(special, dict)}
    if unmet:
        raise ValueError(f"pointer_rules.py: {persona['name']} has no rule {', '.join(sorted(unmet))}")
    rules: list[Any] = []
    for special in persona.get("specials") or []:
        text = str(special.get("description") or "").strip() if isinstance(special, dict) else ""
        if text and points_to_skill(special["name"], text):
            given = _skill_pointer(special, skills, log, persona["name"])
            if given is not None:
                _give(persona, given)
                log.skills.append((persona["name"], special["name"], ", ".join(given), False))
                continue
        elif isinstance(special, dict) and special.get("name") in kept:
            also = skills.named(kept[special["name"]], persona["name"])
            _give(persona, also)
            log.skills.append((persona["name"], special["name"], ", ".join(also), True))
        rules.append(special)
    persona["specials"] = rules


def render_pointers(log: PointerLog) -> str:
    """The report's Pointer rules section: the skills each rule now starts him with, the rules taken from another
    entry, and those left pointing."""
    lines = [
        "## Pointer rules and starting skills",
        "",
        "A fighter's or dramatis persona's own rule that only pointed to a skill, or said he has one, is now the skill,"
        ' which he starts with as one he\'d learned (William, 7 Nov 2026: "yes please do that";'
        " catalogue_import/pointer_rules.py), and the rule goes; a rule that says more keeps its text:",
        "",
    ]
    lines += [
        f"- {owner}: {rule}, {'keeps the rule and ' if kept else ''}starts with {skills}."
        for owner, rule, skills, kept in log.skills
    ] or ["- none"]
    lines += ["", "A rule pointing to another fighter's entry takes that rule:", ""]
    lines += [f"- {owner}: {rule}, from {source}." for owner, rule, source in log.entries] or ["- none"]
    lines += ["", "Left pointing (nothing to take the rule from):", ""]
    lines += [f'- {owner}: {rule}, "{text}"' for owner, rule, text in log.unresolved] or ["- none"]
    return "\n".join(lines) + "\n"
