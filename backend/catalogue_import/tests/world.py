"""A tiny warband world for the import tests: a few types, two groups and the readers built on them."""

from typing import Any

from catalogue_import.availability import Context
from catalogue_import.statements import PhraseReader
from catalogue_import.warbands import Resolver, build_warband_types


def warband(
    name: str, race: str, code: str = "X", setting: str | None = "mordheim", grade: str = "1a"
) -> dict[str, Any]:
    slug = name.lower().replace(" ", "-")
    return {
        "name": name,
        "race": race,
        "broheim_grade": grade,
        "mordheimer_grade": grade,
        "setting": setting,
        "source_code": code,
        "source": "Town Cryer",
        "broheim_pdf": f"https://broheim.example/{slug}.pdf",
        "mordheimer_url": f"https://mordheimer.example/{slug}",
    }


ROWS = [
    warband("Skaven", "Skaven"),
    warband("Forest Goblins", "Goblin", grade="1b"),
    warband("Lizardmen", "Lizardmen", grade="1b"),
    warband("Witch Hunters", "Human"),
    warband("Sisters of Sigmar", "Human"),
    warband("Reiklanders", "Human"),
    warband("Pit Fighters", "All", grade="1b"),
]


def world() -> tuple[list[dict[str, Any]], Resolver, list[dict[str, Any]], Context]:
    types = build_warband_types(ROWS)
    resolver = Resolver(types)
    groups = [
        {"slug": "sigmarite", "name": "Sigmarite", "members": ["witch-hunters", "sisters-of-sigmar"]},
        {"slug": "humans", "name": "Humans", "members": ["witch-hunters", "sisters-of-sigmar", "reiklanders"]},
        {"slug": "skaven", "name": "Skaven", "members": ["skaven"]},
    ]
    names = {row["slug"]: row["name"] for row in types}
    return types, resolver, groups, Context(PhraseReader(resolver, groups), groups, names)
