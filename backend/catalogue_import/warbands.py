"""Warband types, one per Broheim row, and the resolver that maps the warband names in mordheimer's data to them."""

from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import norm_name, slugify
from catalogue_import.grading import content_setting

# Names in mordheimer's data that match no warband type, or more than one, with the proposed mapping and why.
# Every use lands in the report; overrides.json "warband_aliases" replaces any of them.
ALIASES: dict[str, tuple[list[str], str]] = {
    "night goblins": (
        ["night-goblins-mic"],
        'two types share the name; mordheimer calls the WEB one "Night Goblins (web)"',
    ),
    "night goblins web": (["night-goblins-web"], "the WEB (TBMF) Night Goblins"),
    "night goblins (web)": (["night-goblins-web"], "the WEB (TBMF) Night Goblins"),
    "the sons of hashut": (["sons-of-hashut"], 'same warband, with "The"'),
    "sons of hashut:": (["sons-of-hashut"], "same warband, stray colon"),
    "outlaws of stirwood forest": (["the-outlaws-of-stirwood-forest"], 'same warband, without "The"'),
    "the cursed cavalcade": (["cursed-cavalcade"], 'same warband, with "The"'),
    "ostlander mercenaries": (["ostlanders"], "the Ostlanders' skill list"),
    "snotling warband": (["snotlings"], "the Snotlings' skill list"),
    "chaos dwarfs": (
        ["black-dwarfs"],
        "no type has this name; Border Town Burning's Chaos Dwarf warband is Black Dwarfs",
    ),
    "amazons": (["amazons-lustria", "amazons-mordheim"], 'Penthesilea joins "Amazon warbands": both Amazon types'),
    "bretonnians": (["bretonnian-knights"], "a skill list; the Bretonnian Knights are mordheimer's Bretonnian warband"),
    "mercenaries": ([], "Wolfcloak lists it beside Middenheimers, but its own note names only three warbands"),
}


def extra_rows(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """overrides.json "extra_warband_types" in warbands-merged.json's shape: its grade and Broheim PDF where the
    entry gives them (the Sartosa Orc Pirates and Savage Orcs, two warbands of one PDF), else none."""
    return [
        {
            "name": entry["name"],
            "race": entry.get("race", ""),
            "broheim_grade": entry.get("broheim_grade"),
            "mordheimer_grade": None,
            "setting": entry["setting"],
            "source_code": entry.get("source_code", ""),
            "source": entry.get("source", ""),
            "broheim_pdf": entry.get("broheim_pdf", ""),
            "mordheimer_url": "",
        }
        for entry in entries
    ]


def build_warband_types(
    rows: list[dict[str, Any]], names: dict[str, str] | None = None, dropped: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    """One row per Broheim warband. A name used by several types gets its source code in the slug. `names`
    (overrides.json "warband_type_names") puts a source's name right ("Arabyan Theives"), its slug kept; one that
    names no row stops the build. `dropped` ("drop_warband_types": a source's name -> why) leaves a warband out, so
    its slug reaches no file and the seeder archives the type (the Sartosa Orc Pirates & Savage Orcs, which William
    split into two warbands on 11 Nov 2026)."""
    renamed, out = dict(names or {}), dict(dropped or {})
    for key, found in (("warband_type_names", renamed), ("drop_warband_types", out)):
        unknown = set(found) - {row["name"] for row in rows}
        if unknown:
            raise ValueError(f"overrides.json {key}: no warband type {', '.join(sorted(unknown))}")
    rows = [row for row in rows if row["name"] not in out]
    clashes = Counter(slugify(row["name"]) for row in rows)
    types = []
    for row in rows:
        base = slugify(row["name"])
        slug = f"{base}-{slugify(row['source_code'])}" if clashes[base] > 1 else base
        named = row.get("setting")
        setting = content_setting(named, row["broheim_grade"])
        types.append(
            {
                "slug": slug,
                "name": renamed.get(row["name"], row["name"]),
                "setting": setting,
                "setting_assumed": not named,
                "race": row.get("race") or "",
                "broheim_grade": row["broheim_grade"],
                "mordheimer_grade": row.get("mordheimer_grade"),
                "source": row.get("source") or "",
                "source_code": row.get("source_code") or "",
                "link_url": row.get("mordheimer_url") or row.get("broheim_pdf") or "",
                "broheim_url": row.get("broheim_pdf") or "",
                "mordheimer_url": row.get("mordheimer_url") or "",
            }
        )
    return types


@dataclass
class NameUse:
    name: str
    slugs: list[str]
    how: str
    where: set[str] = field(default_factory=set)


class Resolver:
    """Maps a warband name from mordheimer's data to type slugs, remembering every name that needed help."""

    def __init__(self, types: list[dict[str, Any]], overrides: dict[str, list[str]] | None = None) -> None:
        self.types = types
        self.order = {row["slug"]: index for index, row in enumerate(types)}
        self.mordheimer = {row["slug"] for row in types if row["mordheimer_url"]}
        self.by_name: dict[str, list[str]] = {}
        for row in types:
            self.by_name.setdefault(norm_name(row["name"]), []).append(row["slug"])
        self.overrides = {norm_name(name): slugs for name, slugs in (overrides or {}).items()}
        self.uses: dict[str, NameUse] = {}

    def _lookup(self, name: str) -> tuple[list[str], str] | None:
        """Type slugs for a name and how they were found ("" for a plain match). overrides.json wins; where it keeps
        the mapping the build would make, the report shows that mapping's reason as settled."""
        key = norm_name(name)
        built = self._built(key)
        if key in self.overrides:
            slugs = self.overrides[key]
            if built and built[1] and set(built[0]) == set(slugs):
                return slugs, f"settled in overrides.json: {built[1]}"
            return slugs, "overrides.json"
        return built

    def _built(self, key: str) -> tuple[list[str], str] | None:
        if key in ALIASES:
            slugs, why = ALIASES[key]
            return slugs, why
        matches = self.by_name.get(key, [])
        known = [slug for slug in matches if slug in self.mordheimer]
        if len(known) > 1:
            return known, "the name matches more than one mordheimer warband type: mapped to all of them"
        if known or matches:
            return known or matches, ""
        return None

    def find(self, name: str) -> list[str]:
        """Type slugs for a name, without recording it ([] when it matches nothing)."""
        found = self._lookup(name)
        return found[0] if found else []

    def resolve(self, name: str, where: str) -> list[str]:
        """Type slugs for a name ([] when it matches nothing; the report lists it)."""
        found = self._lookup(name)
        slugs, how = found if found else ([], "no match: left out")
        if how:
            use = self.uses.setdefault(name, NameUse(name, slugs, how))
            use.where.add(where)
        return slugs

    def resolve_all(self, names: list[str], where: str) -> list[str]:
        slugs: list[str] = []
        for name in names:
            slugs.extend(slug for slug in self.resolve(name, where) if slug not in slugs)
        return sorted(slugs, key=self.order.__getitem__)
