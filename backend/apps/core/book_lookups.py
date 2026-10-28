"""What the bestiary and hireling seeders resolve an entry's links against: the book's skills, specials, spells and
items (BUG-17), by name with apostrophes straightened, through the aliases their data uses for book names (BUG-54).
A hired sword's (or dramatis persona's) own specials, spells and special skills that the book lacks are created in
it under "Hired Sword - <name>" (or "Dramatis Persona - <name>").
"""

import re
from dataclasses import dataclass
from typing import Any

from django.db.models import Model

from apps.core.seeding import parse_int
from apps.items.models import Item
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

SKILL_NAME_ALIASES = {  # the Ninja's and the Knight of the White Wolf's skills under their book names (BUG-54)
    "lightning speed": "lightning reflexes",
    "leap of faith": "leap",
    "ride warhorse": "ride [animal]",
}
SPELL_PREFIX = re.compile(r"^(\d+)\s*-\s*")  # "1 - Banishment": the Dark Mage's D6 roll (BUG-54)
SPELL_DIFFICULTY = re.compile(r"^Difficulty (\d+)")

EQUIPMENT_NAME_ALIASES = {
    "horse": "riding/draft horse",  # BUG-54
    "scythe": "double-handed weapon",  # a Priest of Morr's scythe is one (BUG-54)
    "throwing knife": "throwing knives/stars",
    "throwing daggers": "throwing knives/stars",
    "throwing stars": "throwing knives/stars",
    "throwing axes": "throwing knives/stars",
    "double-handed axe": "double-handed weapon",
    "two-handed sword": "double-handed weapon",
    "brace of pistols": "pistol",
    "staff": "quarter staff",
    "rune staff": "quarter staff",
    "claws": "fighting claws",
    "repeating crossbow": "repeater crossbow",
    "dark cloak": "sea dragon cloak",
    "mining pick": "double-handed weapon",
    "pick": "double-handed weapon",
    "pickaxe": "double-handed weapon",
    "hammer": "club, mace or hammer",
    "club": "club, mace or hammer",
    "hunter's cloak": "forest cloak",
    "whip": "barbed whip",
    "scimitar": "sword",
    "longbow": "long bow",
    "shortbow": "short bow",
    "healing herbs": "healing herb",
    "gromril hammer": "gromril weapon",
    "hammer of sigmar": "sigmarite warhammer",
    "holy water": "blessed water",
    "wolf cloak": "wolfcloak",
    "fireworks": "firecrackers",
    "superior black powder": "superior blackpowder",
    "hardened leathers": "toughened leathers",
    "bo": "quarter staff",
    "rope and hook": "rope & hook",
}


def lookup_key(value):
    text = str(value or "").strip()
    if not text:
        return ""
    # Normalize mixed apostrophe encodings (including mojibake) from source docs.
    text = text.replace("â€™", "'")
    text = re.sub(r"[`\u0092\u2018\u2019]", "'", text)
    text = re.sub(r"\s+", " ", text)
    return text.lower()


def name_and_description(item):
    """Return (name, description) from either a plain string or a dict; curly apostrophes in the name are
    straightened, so "Jozun’s Decay" is stored and matched as "Jozun's Decay" (BUG-54)."""
    if isinstance(item, str):
        name, description = item, ""
    elif isinstance(item, dict):
        name, description = item.get("name", ""), item.get("description", "").strip()
    else:
        return "", ""
    return re.sub(r"[`‘’]", "'", name).strip(), description


def spell_fields(spell_item):
    """A hired sword's own spell: its name without the "N - " roll prefix, and the fields a book spell has."""
    name, description = name_and_description(spell_item)
    prefix = SPELL_PREFIX.match(name)
    difficulty = SPELL_DIFFICULTY.match(description)
    return SPELL_PREFIX.sub("", name), {
        "description": description,
        "roll": int(prefix.group(1)) if prefix else None,
        "dc": difficulty.group(1) if difficulty else "",
    }


@dataclass
class EntryLinks:
    """What a seeded entry links: its skills, specials and spells, and its equipment (item id -> quantity)."""

    skills: list[Skill]
    specials: list[Special]
    spells: list[Spell]
    quantities: dict[int, int]


class BookLookups:
    """One run's caches of the book's skills, specials and spells (by name) and items (by name and type, and by name),
    and the warnings the run prints: links it couldn't resolve and entries it created. An entry's own specials,
    spells and special skills are created under "<own_type> - <name>" ("Hired Sword - Dark Mage")."""

    def __init__(self, own_type: str = "Hired Sword") -> None:
        self.own_type = own_type
        book = {"campaign__isnull": True, "campaign_type__isnull": True}
        self.skills = {lookup_key(row.name): row for row in Skill.objects.filter(**book)}
        self.specials = {lookup_key(row.name): row for row in Special.objects.filter(**book)}
        self.spells = {lookup_key(row.name): row for row in Spell.objects.filter(**book)}
        self.items: dict[tuple[str, str], Item] = {}
        self.item_names: dict[str, Item] = {}
        for item in Item.objects.filter(**book):
            self.remember_item(item)
        self.warnings: list[str] = []

    def own_type_of(self, owner: str) -> str:
        """The type an entry's own special, spell or special skill is created under."""
        return f"{self.own_type} - {owner}"

    def remember_item(self, item: Item) -> None:
        self.items[(lookup_key(item.name), lookup_key(item.type))] = item
        self.item_names.setdefault(lookup_key(item.name), item)

    def skill(self, name: str, owner: str) -> Skill | None:
        key = lookup_key(name)
        found = self.skills.get(SKILL_NAME_ALIASES.get(key, key))
        if found is None:
            self.warnings.append(f"  Skill '{name}' not found for '{owner}'")
        return found

    def special(self, item: Any, owner: str) -> Special | None:
        name, description = name_and_description(item)
        return self._own(Special, self.specials, name, description, owner, "special") if name else None

    def special_skills(self, items: list[Any], owner: str) -> bool:
        """A hired sword's special skills, made sure of in the book; whether he has any."""
        named = [(name, description) for name, description in map(name_and_description, items) if name]
        for name, description in named:
            self._own(Skill, self.skills, name, description, owner, "skill")
        return bool(named)

    def spell(self, item: Any, owner: str) -> Spell | None:
        name, fields = spell_fields(item)
        if not name:
            return None
        spell = self.spells.get(lookup_key(name))
        if spell is None:  # his own spell (the Dark Mage's six), as specials and skills are (BUG-54)
            spell_type = self.own_type_of(owner)
            spell = Spell.objects.create(name=name, type=spell_type, **fields)
            self.spells[lookup_key(name)] = spell
            self.warnings.append(f"  Created spell '{name}' ({spell_type}) for '{owner}'")
        return spell

    def equipment(self, line: dict[str, Any], owner: str) -> Item | None:
        """The item an equipment line names: by name and type when it gives a type, else by name."""
        key = lookup_key(line.get("item", ""))
        alias, item_type = EQUIPMENT_NAME_ALIASES.get(key, key), lookup_key(line.get("item_type", ""))
        found = (self.items.get((alias, item_type)) if item_type else None) or self.item_names.get(alias)
        if found is None:
            self.warnings.append(f"  Equipment '{line.get('item')}' not found for '{owner}'")
        return found

    def links(self, data: dict[str, Any], owner: str) -> EntryLinks:
        """The skills, specials, spells and equipment a seeded entry lists, resolved in the book (its own specials and
        spells created there); unresolved ones are warned about and left out."""
        links = EntryLinks(
            skills=[skill for name in data.get("skills", []) if (skill := self.skill(name, owner))],
            specials=[special for item in data.get("specials", []) if (special := self.special(item, owner))],
            spells=[spell for item in data.get("spells", []) if (spell := self.spell(item, owner))],
            quantities={},
        )
        for equipment in data.get("equipment", []):
            line = {"item": equipment, "quantity": 1} if isinstance(equipment, str) else equipment
            item = self.equipment(line, owner)
            if item:  # an item listed twice keeps its last quantity
                links.quantities[item.id] = parse_int(line.get("quantity"), 1)
        return links

    def _own(
        self, model: type[Model], cache: dict[str, Any], name: str, description: str, owner: str, noun: str
    ) -> Any:
        """The book's entry of the name, its description filled in when it has none; created as the owner's when the
        book lacks it."""
        key = lookup_key(name)
        row = cache.get(key)
        if row is None:
            kind = self.own_type_of(owner)
            row = model._default_manager.create(name=name, type=kind, description=description, campaign=None)
            cache[key] = row
            self.warnings.append(f"  Created {noun} '{name}' ({kind}) for '{owner}'")
        elif description and not row.description:
            row.description = description
            row.save(update_fields=["description"])
        return row
