"""The shape of a PDF warband's source file (`sources/pdf-warbands/`): the keys a page, its variants, lists, lines,
fighters, rules, stubs, price rows and upgrade groups hold, and what each must be, with the two readers `pdf_check.py`
checks a file with."""

from typing import Any

from catalogue_import.pdf_warbands import SHARED

Spec = dict[str, tuple[type | tuple[type, ...], bool]]
PAGE: Spec = {
    "warbandType": (str, True),
    "name": (str, True),
    "source": (str, True),
    "sourceLink": (str, True),
    "warbandRules": (dict, True),
    "variants": (list, False),
    "specialRules": (list, True),
    "equipmentLists": (list, True),
    "specialEquipment": (list, False),
    "fighters": (list, True),
    "skillGroup": (dict, False),
    "specialSkillsList": (list, False),
    SHARED: (dict, False),
    "aliases": (list, True),
    "stubs": (list, True),
    "mutations": (list, False),
    "itemRules": (list, False),
    "priceRows": (list, False),
    "flags": (list, True),
}
WARBAND_RULES: Spec = {"startingGc": (int, True), "maxModels": (int, True)}
RULE: Spec = {"rulename": (str, True), "ruleFull": (str, True), "variant": (str, False)}
VARIANT: Spec = {
    "key": (str, True),
    "name": (str, True),
    "startingGc": (int, False),
    "maxModels": (int, False),
    "rareBonus": (int, False),
    "rareBonusExcept": (list, False),
}
LIST: Spec = {"id": (str, True), "title": (str, True), "caveat": (str, True), "items": (list, True)}
LINE: Spec = {"name": (str, True), "alias": (str, True), "cost": (dict, True), "variant": (str, False)}
COST: Spec = {"cost": (int, True), "costPrefix": (str, False), "costSuffix": (str, False), "braceCost": (int, False)}
SPECIAL: Spec = {
    "title": (str, True),
    "alias": (str, False),
    "cost": (dict, True),
    "availability": (str, True),
    "maxQty": (int, False),
}
FIGHTER: Spec = {
    "id": (str, True),
    "type": (str, True),
    "name": (str, True),
    "plural": (str, True),
    "race": (str, True),
    "minQty": (int, True),
    "maxQty": (int, False),
    "groupSize": (dict, False),
    "costGc": (int, True),
    "startingXp": (int, False),
    "gainExp": (bool, False),
    "promotable": (bool, False),
    "statblock": (dict, True),
    "equipmentLists": (list, True),
    "skillAccess": (dict, False),
    "skillGroups": (list, False),
    "skills": (list, False),  # the skills he starts with, by our names
    "equipment": (str, False),
    "spellLores": (list, False),
    "specialRules": (list, True),
    "variantChanges": (dict, False),  # what a variant changes about him, by its key
}
VARIANT_CHANGE: Spec = {
    "skillAccess": (dict, False),
    "skills": (list, False),
    "stats": (dict, False),
    "maxCount": ((int, type(None)), False),
}
GROUP: Spec = {"min": (int, True), "max": (int, True)}
SKILL_GROUP: Spec = {"name": (str, True), "new": (bool, True), "note": (str, False)}
SHARED_GROUP: Spec = {"name": (str, True), "note": (str, False), "types": (list, True), "skills": (list, True)}
SKILL: Spec = {"name": (str, True), "description": (str, False), "ours": (str, False), "pdfName": (str, False)}
ALIAS: Spec = {"pdf": (str, True), "ours": (str, True), "page": (int, True)}
STUB: Spec = {
    "name": (str, True),
    "cost": ((int, type(None)), False),  # the setting's trading list, where it differs from the line's price
    "type": (str, True),
    "subtype": (str, True),
    "rarity": ((int, type(None)), True),
    "dice": ((int, type(None)), True),
    "diceMultiplier": ((int, type(None)), False),  # "100 + D6x10": dice 1, diceMultiplier 10
    "rulesPage": (int, True),
    "range": (str, False),
    "strength": (str, False),
    "save": (str, False),
    "rules": (list, False),
    "statblock": (list, False),
    "note": (str, False),
}
STUB_RULE: Spec = {
    "rule": (str, False),
    "name": (str, False),
    "summary": (str, False),
    "text": (str, False),
    "tables": (list, False),
}
UPGRADE_GROUP: Spec = {"mutationName": (str, True), "mutationflavour": (str, True), "items": (list, True)}
UPGRADE: Spec = {"heading": (str, True), "cost": (str, True), "ruleFull": (str, True)}
ITEM_RULE: Spec = {
    "name": (str, True),
    "summary": (str, False),
    "text": (str, True),
    "tables": (list, False),
    "ours": (list, False),
    "page": (int, True),
}
PRICE_ROW: Spec = {
    "name": (str, True),
    "cost": ((int, type(None)), False),  # a row for an item no line of the page sells
    "rarity": ((int, type(None)), True),
    "dice": ((int, type(None)), True),
    "diceMultiplier": ((int, type(None)), False),  # "100 + D6x10": dice 1, diceMultiplier 10
    "types": (list, False),  # the warband types it serves, the page's own among them (a setting's shop list)
    "note": (str, False),
    "page": (int, True),
}
FLAG: Spec = {"page": (int, True), "what": (str, True)}


def shape(value: Any, spec: Spec, where: str, problems: list[str]) -> bool:
    """A dict holding only the spec's keys, each of its type, the required ones present."""
    if not isinstance(value, dict):
        problems.append(f"{where}: not an object")
        return False
    before = len(problems)
    problems += [f"{where}: unknown key {key!r}" for key in sorted(value.keys() - spec.keys())]
    for key, (kind, required) in spec.items():
        if key not in value:
            if required:
                problems.append(f"{where}: no {key!r}")
        elif (isinstance(value[key], bool) and kind is int) or not isinstance(value[key], kind):
            problems.append(f"{where}: {key!r} is {value[key]!r}")
    return len(problems) == before


def _each(rows: Any, spec: Spec, where: str, problems: list[str]) -> list[dict[str, Any]]:
    """The rows of a list key that have the spec's shape (the others reported)."""
    good = []
    for n, row in enumerate(rows if isinstance(rows, list) else []):
        own: list[str] = []
        if shape(row, spec, f"{where} {n + 1}", own):
            good.append(row)
        problems += own
    return good
