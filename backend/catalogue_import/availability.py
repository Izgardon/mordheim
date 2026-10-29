"""Price rows for a mordheimer item: who may buy it at which cost and rarity. Where mordheimer's structured fields
and its own notes disagree, a default is chosen and the disagreement goes into the report."""

from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import as_list, unique
from catalogue_import.groups import collapse
from catalogue_import.prices import Cost, mordheimer_cost, parse_rarity
from catalogue_import.statements import PhraseReader, Readings, Statements, read_statements


@dataclass
class Context:
    reader: PhraseReader
    groups: list[dict[str, Any]]
    names: dict[str, str]
    conflicts: list[dict[str, str]] = field(default_factory=list)

    def conflict(self, item: str, issue: str, default: str) -> None:
        self.conflicts.append({"item": item, "issue": issue, "default": default})

    def label(self, slugs: list[str] | set[str]) -> str:
        return ", ".join(sorted(self.names.get(slug, slug) for slug in slugs)) or "no one"

    def diff(self, readings: Readings, listed: list[str], verb: str) -> str:
        """How a list differs from the closer reading of a note: what it adds and what it leaves out."""
        have = set(listed)
        said = min((readings.as_types, readings.as_groups), key=lambda reading: len(reading ^ have))
        parts = [
            f"also {verb} {self.label(have - said)}" if have - said else "",
            f"leaves out {self.label(said - have)}" if said - have else "",
        ]
        return "its list " + " and ".join(part for part in parts if part)


def _warbands(slugs: list[str], excluded: bool, ctx: Context) -> list[dict[str, Any]]:
    return [{**entry, "excluded": excluded} for entry in collapse(slugs, ctx.groups)]


def _row(
    cost: Cost, rarity: int | None, everyone: bool, warbands: list[dict[str, Any]], note: str, label: str = ""
) -> dict[str, Any]:
    return {"label": label, **cost, "rarity": rarity, "for_everyone": everyone, "warbands": warbands, "note": note}


def _who(item: dict[str, Any], found: Statements, ctx: Context) -> tuple[bool, list[str], list[str]]:
    """(for everyone, included types, excluded types) from the structured lists, checked against the notes."""
    resolve = ctx.reader.resolver.resolve_all
    name, permitted, excluded = item["name"], as_list(item.get("permittedWarbands")), item.get("excludedWarbands")
    if permitted:
        included = resolve(permitted, "items")
        for text, readings in found.who:
            if not readings.matches(set(included)):
                detail = ctx.diff(readings, included, "names")
                ctx.conflict(name, f'Its note says "{text}"; {detail}', "the list")
        return False, included, []
    if excluded != "all":
        shut_out = resolve(as_list(excluded), "items")
        for text, readings in found.excluded:
            if not readings.matches(set(shut_out)):
                detail = ctx.diff(readings, shut_out, "excludes")
                ctx.conflict(name, f'Its note says "{text}"; {detail}', "the exclusion list")
        return True, [], shut_out
    return _nobody(item, found, ctx)


def _nobody(item: dict[str, Any], found: Statements, ctx: Context) -> tuple[bool, list[str], list[str]]:
    """mordheimer's excludedWarbands "all" with no permitted list: no one may buy it."""
    name = item["name"]
    if found.who:
        text, readings = found.who[0]
        included = sorted(readings.as_types, key=ctx.reader.resolver.order.__getitem__)
        ctx.conflict(name, f'Its lists let no one buy it; its note says "{text}"', f"the note: {ctx.label(included)}")
        return False, included, []
    if item.get("campaignSetting"):
        setting = item["campaignSetting"]
        ctx.conflict(
            name,
            f"Its lists let no one buy it; it belongs to the {setting} setting",
            "for everyone, as the setting already limits it",
        )
        return True, [], []
    ctx.conflict(name, "Its lists let no one buy it", 'no warbands listed ("not usually available" to all)')
    return False, [], []


def _override_rows(
    item: dict[str, Any], found: Statements, cost: Cost, shut_out: list[str], ctx: Context
) -> list[tuple[int, list[str]]]:
    """warbandRarityOverride as (rarity, types) pairs, checked against the price notes and the exclusions."""
    name, resolve = item["name"], ctx.reader.resolver.resolve
    by_rarity: dict[int, list[str]] = {}
    for entry in item.get("warbandRarityOverride") or []:
        value = parse_rarity(entry.get("availability"))[0] or 0
        by_rarity.setdefault(value, []).extend(resolve(entry.get("warband", ""), "items"))
    pairs = []
    for value, slugs in by_rarity.items():
        slugs = unique(slugs)
        barred = [slug for slug in slugs if slug in shut_out]
        if barred:
            ctx.conflict(
                name,
                f"Its override prices it for {ctx.label(barred)}, which it excludes",
                "the exclusion: no override row for them",
            )
            slugs = [slug for slug in slugs if slug not in barred]
        for text, rarity, readings in found.prices:
            if rarity == value and readings is not None and not readings.matches(set(slugs)):
                ctx.conflict(
                    name,
                    f'Its override gives {ctx.label(slugs)} this price; its note says "{text}"',
                    f"the note: {ctx.label(readings.as_types)}",
                )
                slugs = sorted(readings.as_types, key=ctx.reader.resolver.order.__getitem__)
        pairs.append((value, slugs))
    return pairs


def _notes(item: dict[str, Any], found: Statements) -> list[str]:
    notes = list(found.notes)
    limit = item.get("purchaseLimit")
    if isinstance(limit, dict) and limit.get("max"):
        count = "one" if limit["max"] == 1 else str(limit["max"])
        notes.append(f"max {count} per warband")
    seen: dict[str, str] = {}
    for note in notes:
        seen.setdefault(note.lower(), note)
    return list(seen.values())


def mordheimer_rows(item: dict[str, Any], ctx: Context) -> list[dict[str, Any]]:
    found = read_statements(item, ctx.reader)
    cost = mordheimer_cost(item.get("cost"))
    rarity, rarity_note = parse_rarity(item.get("availability"))
    everyone, included, shut_out = _who(item, found, ctx)
    warbands = _warbands(included, False, ctx) + _warbands(shut_out, True, ctx)
    notes = _notes(item, found)
    if cost["cost"] is None and not cost["cost_note"]:
        if not everyone and not included:
            return []  # the Fist: nothing to buy
        rarity_note = "; ".join(filter(None, [rarity_note, "No price in the source"]))
    base_note = "; ".join(notes + ([rarity_note] if rarity_note else []))
    rows = [_row(cost, rarity, everyone, warbands, base_note)]
    brace = (item.get("cost") or {}).get("braceCost")
    if isinstance(brace, dict):
        brace_rarity = parse_rarity(item["braceAvailability"])[0] if "braceAvailability" in item else rarity
        rows.append(_row(mordheimer_cost(brace), brace_rarity, everyone, warbands, base_note, "Brace"))
    for value, slugs in _override_rows(item, found, cost, shut_out, ctx):
        if slugs:
            rows.append(_row(cost, value or None, False, _warbands(slugs, False, ctx), "; ".join(notes)))
    if found.skink_cost is not None:
        skinks = ctx.reader.resolver.resolve("Lizardmen", "items")
        flat: Cost = {"cost": found.skink_cost, "dice": None, "dice_multiplier": None, "cost_note": ""}
        rows.append(_row(flat, None, False, _warbands(skinks, False, ctx), "; ".join(notes), "Skink heroes"))
    return rows
