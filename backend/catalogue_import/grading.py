"""Settings and their grades. Only settings carry a grade: a setting split by grade has one part per grade, and any
other named setting takes the grade most of its contents have.

Two settings are split: Mordheim, and Khemri (William, 11 Nov 2026: "Lets just add a Khemri 3 setting like we do
for mordheim? we will need to make sure the items from those warbands and skills etc follow"). A split's base part
keeps the family's slug and carries its grade in its name ("mordheim" is "Mordheim 1a", "khemri" is "Khemri 1b"),
and a grade the split names no part for stays in the base part. Splitting a setting is the only way a minority
grade escapes the majority rule, which would otherwise bury Khemri's eight grade 3 warbands in its 1b.
"""

from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import GRADE_RANK, majority, normalise_grade

MORDHEIM_PARTS = {
    "1a": "mordheim",
    "1b": "mordheim-1b",
    "1c": "mordheim-1c",
    "2a": "mordheim-2a",
    "2b": "mordheim-2a",  # Mordheim's 2b content (the Snotlings' skills) folds into 2a
    "3": "grade-3",
}
KHEMRI_PARTS = {"3": "khemri-3"}  # the rest of Khemri (1b) stays in the base part
SPLIT_PARTS = {"mordheim": MORDHEIM_PARTS, "khemri": KHEMRI_PARTS}
# each part of a split setting, and the base part itself, to the family it belongs to
SPLIT_FAMILY = {
    **{base: base for base in SPLIT_PARTS},
    **{part: base for base, parts in SPLIT_PARTS.items() for part in parts.values()},
}
FIXED_GRADES = {
    "mordheim": "1a",
    "mordheim-1b": "1b",
    "mordheim-1c": "1c",
    "mordheim-2a": "2a",
    "grade-3": "3",
    "khemri": "1b",
    "khemri-3": "3",
}
SETTING_NAMES = {
    "mordheim": "Mordheim 1a",  # the grade in its name, as its 1b, 1c and 2a have (the review, 5 Nov 2026: D4)
    "mordheim-1b": "Mordheim 1b",
    "mordheim-1c": "Mordheim 1c",
    "mordheim-2a": "Mordheim 2a",
    "empire-in-flames": "Empire in Flames",
    "lustria": "Lustria",
    "khemri": "Khemri 1b",  # the grade in its name, as every part of a split setting has
    "khemri-3": "Khemri 3",
    "nemesis-crown": "The Nemesis Crown",
    "border-town-burning": "Border Town Burning",
    "sylvania": "Sylvania",
    "mutiny-in-marienburg": "Mutiny in Marienburg",
    "sartosa": "Sartosa",
    "mousillon": "Mousillon",
    "karak-azgal": "Karak Azgal",
    "relics-of-the-crusades": "Relics of the Crusades",
    "sealed-city": "The Sealed City",
    "karak-eight-peaks": "Karak Eight Peaks",
    "athel-loren": "Athel Loren",
    "grade-3": "Grade 3",
}
SETTING_ORDER = list(SETTING_NAMES)
KINDS = ("warbands", "items", "skills", "hired_swords", "dramatis_personae")


def setting_part(base: str, grade: str | None) -> str:
    """The part of `base` that holds this grade's content: `base` itself when it isn't split by grade, or when its
    split names no part for the grade (Khemri's base part holds every grade but 3)."""
    return SPLIT_PARTS.get(base, {}).get(grade or "1a", base)


def mordheim_part(grade: str | None) -> str:
    """The Mordheim setting for content outside the named settings, by its grade (core and unknown are 1a)."""
    return setting_part("mordheim", normalise_grade(grade))


def content_setting(named: object, grade: object) -> str:
    """A named setting wins, split by grade where it is split (Khemri 3); "mordheim", blank or missing falls back
    to Mordheim's part for the grade."""
    code = normalise_grade(grade)
    if isinstance(named, str) and named and named != "mordheim":
        return setting_part(named, code)
    return mordheim_part(code)


@dataclass
class Evidence:
    """What each setting holds, by kind and by grade, for the majority rule and the report's counts."""

    counts: dict[str, Counter[str]] = field(default_factory=dict)
    grades: dict[str, list[str]] = field(default_factory=dict)
    odd_grades: list[tuple[str, str, str]] = field(default_factory=list)

    def add(self, setting: str, kind: str, grade: object, name: str) -> None:
        self.counts.setdefault(setting, Counter())[kind] += 1
        code = normalise_grade(grade)
        if code:
            self.grades.setdefault(setting, []).append(code)
        else:
            self.odd_grades.append((setting, name, str(grade)))


def _named_settings(entry: dict[str, Any]) -> list[str]:
    many = entry.get("campaignSettings")
    if isinstance(many, list) and many:
        return [value for value in many if isinstance(value, str)]
    return [content_setting(entry.get("campaignSetting"), entry.get("grade"))]


def collect_evidence(warband_types: list[dict[str, Any]], sources: Any) -> Evidence:
    evidence = Evidence()
    for row in warband_types:
        evidence.add(row["setting"], "warbands", row["broheim_grade"], row["name"])
    for item in sources.items:
        evidence.add(
            content_setting(item.get("campaignSetting"), item.get("grade")), "items", item.get("grade"), item["name"]
        )
    for item in sources.mim_items:
        evidence.add("mutiny-in-marienburg", "items", item.get("grade"), item["name"])
    for kind, rows in (
        ("skills", sources.skills),
        ("hired_swords", sources.hired_swords),
        ("dramatis_personae", sources.personae),
    ):
        for entry in rows:
            for setting in _named_settings(entry):
                evidence.add(setting, kind, entry.get("grade"), entry.get("name", ""))
    return evidence


def _sort_key(slug: str) -> tuple[int, str]:
    return (SETTING_ORDER.index(slug), slug) if slug in SETTING_ORDER else (len(SETTING_ORDER), slug)


def build_settings(evidence: Evidence, grade_overrides: dict[str, str]) -> list[dict[str, Any]]:
    slugs = sorted(set(evidence.counts) | set(FIXED_GRADES), key=_sort_key)
    rows = []
    for order, slug in enumerate(slugs, start=1):
        seen = evidence.grades.get(slug, [])
        if slug in grade_overrides:
            grade, basis = grade_overrides[slug], "set in overrides.json"
        elif slug in FIXED_GRADES:
            grade, basis = FIXED_GRADES[slug], f"{SPLIT_FAMILY.get(slug, slug).title()} split by grade"
        else:
            grade = majority(seen, GRADE_RANK) or "1a"
            basis = f"majority of {len(seen)} graded entries"
        counts = evidence.counts.get(slug, Counter())
        rows.append(
            {
                "slug": slug,
                "name": SETTING_NAMES.get(slug, slug.replace("-", " ").title()),
                "grade": grade,
                "sort_order": order,
                "always_on": slug == "mordheim",
                "grade_basis": basis,
                "counts": {kind: counts.get(kind, 0) for kind in KINDS},
                "grades_seen": dict(sorted(Counter(seen).items(), key=lambda pair: GRADE_RANK[pair[0]])),
            }
        )
    return rows
