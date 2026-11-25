"""How a battle's neutral groups are read (services/neutrals.py writes them): the stored list, a creature's type, and
the groups as a snapshot sends them, each creature with its own type and profile. A group stored before carried one
type, profile and wounds for all its creatures; they are read off the group."""

from typing import Any

from ..models import Battle


def neutral_groups(battle: Battle) -> list[dict[str, Any]]:
    raw = battle.neutral_groups_json
    return [group for group in raw if isinstance(group, dict)] if isinstance(raw, list) else []


def creature_type(group: dict[str, Any], creature: dict[str, Any]) -> str:
    """A creature's type: its own, else the one a group stored before kept for all of them."""
    return str(creature.get("creature_type") or group.get("creature_type") or "")


def creatures_of(group: dict[str, Any]) -> list[dict[str, Any]]:
    return [creature for creature in group.get("creatures", []) if isinstance(creature, dict)]


def public_groups(battle: Battle) -> list[dict[str, Any]]:
    """The groups as a snapshot sends them: a name and creatures, each with its own type, profile and wounds."""
    groups = []
    for group in neutral_groups(battle):
        creatures = [
            {
                **creature,
                "creature_type": creature_type(group, creature),
                "stats": creature.get("stats", group.get("stats") or {}),
                "max_wounds": creature.get("max_wounds", group.get("max_wounds") or 1),
            }
            for creature in creatures_of(group)
        ]
        groups.append({"key": group.get("key"), "name": group.get("name"), "creatures": creatures})
    return groups
