"""Warband templates read from the warbands' PDFs (William, 5 Nov 2026: "lets begin adding warbands in via their pdfs
... start in small batches so we can vet"): one source file per warband in `sources/pdf-warbands/`, written by hand
from its PDF in the snapshot's page shape (`snapshot.py`) with the rules in our own words, and loaded beside the
snapshot so the template import builds it the same way. A file's own keys:

- `warbandType`: the slug of our warband type it serves (the file is named after it; nothing is matched by name);
  the template's setting and grade are the type's;
- `aliases`: `{pdf, ours, page}`, a line's name as the PDF spells it and our item's name or tag it means
  ("Doubled-handed weapon" is a Double-handed weapon), put right as the file loads;
- `stubs`: `{name, type, subtype, rarity, dice, diceMultiplier, rulesPage, note, types}`, items a line names that we
  lack (William: "yes to
  stubs"): each a bare item, no rules, with one price row for its warband only, or for every type it names (`types`,
  as a price row's: a setting's shop list declares an item it alone sells once), at the line's price (`cost`: the price
  the setting's own trading list prints, where that differs from the line's), and `note` its
  item's notes (the Sorcerous Society's Familiar names its pets in the bestiary). A stub whose rules William gives
  carries them (`range`, `strength`, `save` and `rules`: `{rule, summary, text}` a shared item rule by name, ours or
  a page's, in its own words where it gives them, or `{name, text, tables}` its own), and needs rules until it has
  one of its own (the Metal Mongers' Ratling Gun); `statblock`, its profile rows (`{profile, m, ws, ...}`: the Night
  Haint's Mortis Engine, the Channel Rats' Wicker Man);
- `mutations`: the upgrade groups a page sells, in the snapshot's shape (`{mutationName, mutationflavour, items:
  [{heading, cost, ruleFull}]}`), which `template_upgrades.py` reads as it reads a snapshot page's: each item the
  special it gives at its price, the group's own words a warband rule of its name, and its terms (who may buy, the
  most each, the double price of a later one) `template_answers.UPGRADE_TERMS` (the Blood Dragon Vampire's seven
  bloodline abilities). A fighter's buyable extra rules are upgrades, never a warband rule (William, 11 Nov 2026);
- `itemRules`: `{name, summary, text, tables, page, ours}`, shared item rules a page brings, which a few items link
  (William, 6 Nov 2026, of Experimental Technology: "its a shared item rule that a few items will have"); `ours`, our
  items whose own rule it becomes (the Watchmen's Map, our Mordheim Map's rule for any map: "Make the map rule not
  unique to the items, give it to both marienburg and mordheim map");
- `priceRows`: `{name, rarity, dice, diceMultiplier, note, page, types}`, a price row for the page's type on one of our items its lines
  sell (the Low Kings' Spiked Gauntlet: William, 6 Nov 2026, "would prefer them being just one item"), at the line's
  price, or at its own `cost` for an item no line sells (the Wasteland Privateers' Superior Blackpowder, Rare 5 for
  them: William, 11 Nov 2026, "make superior gunpowder our blackpowder in a new price row"). `types`, the warband type
  slugs it serves (the page's own among them), is one row for several types: a setting's shop list is declared once
  (Sartosa's, on `sartosan-pirates.json`, for its eleven types) rather than copied into each page. `diceMultiplier`
  multiplies the dice a price adds, as a stub's does ("100 + D6x10": `dice` 1, `diceMultiplier` 10), and needs dice;
- `skillGroup` (`{name, new, note}`) and `specialSkillsList`: the group the heroes' Special tick names and its skills,
  each `{name, description}` in our words (a new group's new skill) or `{name, ours}` (one of our skills); neither for
  a warband with no Special column (the Outlaws of Stirwood Forest, Redux). Who of the warband may take a skill opens
  a new skill's description ("Gnoblars only."); for one of ours, which other warbands share, it is the new group's
  `note` (William, 6 Nov 2026), shown when learning from it;
- `sharedSkillGroup` (`{name, note, types, skills}`): a new group one page declares for several warband types, its
  skills in `specialSkillsList`'s shape (the Sartosa Pirate Skills, which every Sartosa warband's Pirate column
  names). The pages that share it name it in their fighters' `skillGroups` and declare it no second time;
- a fighter's `skillGroups`: groups he learns from besides his Special tick, each one of ours or a page's shared one
  (a Khorne Raiders Quartermaster ticks Special but not Pirate);
- a fighter's `spellLores`: the lores he casts from, by our spells' lore names;
- a fighter's `skills`: the skills he starts with, by our names (the Mousillon Plague Priest's Resilient), as
  `TemplateFighterSkill` holds them, so they show with his skills and follow any change to the skill (William,
  7 Nov 2026, of a rule that only names a skill: "yes please do that"). A rule that says more than the skill keeps
  its text beside them, as the snapshot's `pointer_rules.py` does;
- `variants`: `[{key, name, startingGc, maxModels, rareBonus, rareBonusExcept}]`, the warband's own variants (the
  House Guard's three houses), as the snapshot's pages take them from `template_answers` (`VARIANTS`,
  `VARIANT_TERMS`). The player picks one when the warband is raised. A warband rule and an equipment list line may
  name one (`variant`: the rules and lines of one house only, the snapshot's `VARIANT_LINES` and `RULE_TYPES` in the
  page itself), and a fighter's `variantChanges` (`{<key>: {skillAccess, skills, stats, maxCount}}`) holds what a
  variant changes about him, his own keys being the first variant's: the Halcon Sergeant's skill table, the
  Commander's Haggle. A page with no `variants` names none;
- `flags`: `{page, what}`, what the PDF leaves unclear, for William.

`check_pdf.py` checks every file against the catalogue (`pdf_check.py`).
"""

from html import escape
from pathlib import Path
from typing import Any

from catalogue_import.common import load_json, loose_key, norm_name, slugify
from catalogue_import.grading import SETTING_ORDER
from catalogue_import.sources import SOURCES
from catalogue_import.template_lists import ItemIndex, line_price
from catalogue_import.text import clean_inline
from catalogue_import.warband_items import _item, _row

PDF_SOURCES = SOURCES / "pdf-warbands"
TYPE = "warbandType"
SHARED = "sharedSkillGroup"  # a new group one page declares for several warband types
ORIGIN = "pdf-warbands"


def is_pdf(page: dict[str, Any]) -> bool:
    return TYPE in page


def put_aliases_right(page: dict[str, Any]) -> None:
    """Each list line and special equipment entry the PDF spells its own way, named as we name its item."""
    names = {norm_name(row["pdf"]): row["ours"] for row in page.get("aliases") or []}
    for raw in page.get("equipmentLists") or []:
        for entry in raw["items"]:
            entry["name"] = names.get(norm_name(entry["name"]), entry["name"])
    for entry in page.get("specialEquipment") or []:
        entry["title"] = names.get(norm_name(entry["title"]), entry["title"])


def tables_as_html(text: str) -> str:
    """A rule's tables, written as lines of cells ("2D6 | Result", then a line a row), as the HTML tables the
    template import reads (template_text.py), so their rows stay lines rather than join as one wrapped paragraph."""
    blocks = []
    for block in text.split("\n\n"):
        lines = block.split("\n")
        if len(lines) > 1 and all(" | " in line for line in lines):
            cells = (
                "<tr>" + "".join(f"<td>{escape(cell.strip(), quote=False)}</td>" for cell in line.split("|")) + "</tr>"
                for line in lines
            )
            block = f"<table>{''.join(cells)}</table>"
        blocks.append(block)
    return "\n\n".join(blocks)


def load_pdf_pages(root: Path = PDF_SOURCES) -> dict[str, dict[str, Any]]:
    """Every file's page by its name (its type's slug), its aliases put right and its rules' tables made HTML."""
    pages = {}
    for path in sorted(root.glob("*.json")):
        page = load_json(path)
        if page.get(TYPE) != path.stem:
            raise ValueError(f"pdf-warbands/{path.name}: its warbandType should be {path.stem!r}")
        put_aliases_right(page)
        for rule in [*page["specialRules"], *(rule for row in page["fighters"] for rule in row["specialRules"])]:
            rule["ruleFull"] = tables_as_html(rule["ruleFull"])
        pages[path.stem] = page
    return pages


VARIANT_OF = "variantOf"  # a page that is one variant of another warband's list, not a warband list of its own


def _fighter_key(name: str) -> str:
    return loose_key(plain_name(name))


def plain_name(name: str) -> str:
    """A fighter's name as both pages write it ("Orc Big ‘Un" and "Orc Big 'Un" are one fighter)."""
    return str(name).replace("‘", "'").replace("’", "'")


def unique_names(names: list[str]) -> list[str]:
    return list(dict.fromkeys(names))


def _page_skill_types(slug: str, page: dict[str, Any], fighter: dict[str, Any]) -> list[str]:
    """The skill groups the page gives the fighter, as its own template would (its Special tick names its group)."""
    from catalogue_import.template_fighters import FighterLog, skill_types  # its page shape, not its pipeline

    return skill_types(slug, fighter, [], FighterLog(), special_groups(page))[0]


def _fold_fighters(page: dict[str, Any], base: dict[str, Any], base_slug: str, key: str, keys: list[str]) -> list[str]:  # noqa: E501
    """The page's fighters into the base page's, as that variant has them: one the base holds keeps his row and the
    page's skill groups, profile and counts become his `variantChanges`; one the base lacks joins the roster and no
    other variant allows any of him; one the page lacks is allowed none in this variant."""
    held = {_fighter_key(fighter["name"]): fighter for fighter in base["fighters"]}
    folded = []
    for fighter in page["fighters"]:
        found = held.get(_fighter_key(fighter["name"]))
        if found is None:
            others = {other: {"maxCount": 0} for other in keys if other != key}
            base["fighters"].append({**fighter, "variantChanges": {**(fighter.get("variantChanges") or {}), **others}})
            folded.append(f"{fighter['name']} (only {key})")
            continue
        found["equipmentLists"] = unique_names(
            [*(found.get("equipmentLists") or []), *(fighter.get("equipmentLists") or [])]
        )  # he buys from this variant's lists too; their lines name the variant
        change: dict[str, Any] = {}
        if fighter.get("skillAccess"):
            mine = _page_skill_types(page[TYPE], page, fighter)
            if mine != _page_skill_types(base_slug, base, found):
                change["skillTypes"] = mine
        if fighter.get("maxQty") != found.get("maxQty"):
            change["maxCount"] = fighter.get("maxQty")
        if change:
            found.setdefault("variantChanges", {})[key] = {**(found.get("variantChanges") or {}).get(key, {}), **change}  # fmt: skip
    for fighter in base["fighters"]:
        if _fighter_key(fighter["name"]) not in {_fighter_key(row["name"]) for row in page["fighters"]}:
            fighter.setdefault("variantChanges", {}).setdefault(key, {})["maxCount"] = 0
            folded.append(f"{fighter['name']} (not {key})")
    return folded


def fold_variant_pages(
    pdf: dict[str, dict[str, Any]], snapshot: dict[str, dict[str, Any]], keys_of: dict[str, list[str]]
) -> list[tuple[str, str, str]]:
    """A PDF page that is one variant of another warband's list (`variantOf`: the Sartosa Orc Pirates and Savage
    Orcs, each "the exact same rules as the Da Mob Warband with the following changes") folds into that page and
    builds no template of its own: its rules and every line of its lists name the variant, and its fighters are the
    variant's (`_fold_fighters`). Its own warband type is served by the page it folds into, which `template_answers`
    says (TEMPLATE_TYPES, VARIANTS). The page is left in `pdf` for the stubs, price rows and skill groups it brings,
    and its name is returned so the template build leaves it out."""
    folded = []
    for slug in sorted(pdf):
        page = pdf[slug]
        spec = page.get(VARIANT_OF)
        if not spec:
            continue
        base, key = snapshot.get(str(spec["page"])), str(spec["key"])
        if base is None:
            raise ValueError(f"pdf-warbands/{slug}.json: {VARIANT_OF} names no snapshot page {spec['page']!r}")
        keys = keys_of.get(str(spec["page"]), [])
        if key not in keys:
            raise ValueError(f"pdf-warbands/{slug}.json: {spec['page']} has no variant {key!r} (template_answers)")
        for raw in base["equipmentLists"]:  # the base warband's own lines are its own variant's
            for entry in raw["items"]:
                entry.setdefault("variant", keys[0])
        held = {clean_inline(rule.get("rulename")) for rule in base["specialRules"]}
        base["specialRules"] += [
            {**rule, "variant": key} for rule in page["specialRules"] if clean_inline(rule["rulename"]) not in held
        ]
        renamed = {raw["id"]: f"{key}-{raw['id']}" for raw in page["equipmentLists"]}  # the base holds lists of its own
        base["equipmentLists"] += [
            {**raw, "id": renamed[raw["id"]], "items": [{**entry, "variant": key} for entry in raw["items"]]}
            for raw in page["equipmentLists"]
        ]
        for fighter in page["fighters"]:  # he buys from his page's lists under their new names
            fighter["equipmentLists"] = [renamed.get(name, name) for name in fighter.get("equipmentLists") or []]
        for what in _fold_fighters(page, base, str(spec["page"]), key, keys):
            folded.append((slug, key, what))
    return folded


def add_pages(pages: dict[str, dict[str, Any]], pdf: dict[str, dict[str, Any]]) -> None:
    """The PDF pages beside the snapshot's, which keep their slugs; a page folded into another builds no template of
    its own (`variantOf`), so it is left out."""
    taken = sorted(set(pages) & set(pdf))
    if taken:
        raise ValueError(f"pdf-warbands: {', '.join(taken)} is a snapshot page too")
    pages.update({slug: page for slug, page in pdf.items() if not page.get(VARIANT_OF)})


# a variant's own terms, as a template holds them, by the key a page writes
VARIANT_TERMS = {
    "startingGc": "starting_gold",
    "maxModels": "max_models",
    "rareBonus": "rare_bonus",
    "rareBonusExcept": "rare_bonus_except",
}


def pdf_variants(page: dict[str, Any]) -> list[dict[str, Any]]:
    """A PDF page's variants in the template's shape (the snapshot's come from `template_answers`): the House Guard's
    three houses, each with its own terms where it has them."""
    return [
        {
            "key": variant["key"],
            "name": variant["name"],
            **{name: variant[key] for key, name in VARIANT_TERMS.items() if key in variant},
        }
        for variant in page.get("variants") or []
    ]


def pdf_types(page: dict[str, Any], types: list[dict[str, Any]]) -> list[dict[str, str]]:
    """The type a PDF page serves, by its slug, with no preset variant."""
    if page[TYPE] not in {row["slug"] for row in types}:
        raise ValueError(f"pdf-warbands: no warband type {page[TYPE]!r}")
    return [{"type": page[TYPE], "variant": ""}]


def special_groups(page: dict[str, Any]) -> list[str] | None:
    """The skill group a PDF page's Special tick names (None for a snapshot page: template_answers says)."""
    return [page["skillGroup"]["name"]] if is_pdf(page) and page.get("skillGroup") else None


def link_of(page: dict[str, Any]) -> str:
    """A PDF page's template links to the PDF it was read from."""
    return str(page.get("sourceLink") or "") if is_pdf(page) else ""


def pdf_lores(pages: dict[str, dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, str]]]:
    """(page, fighter name) -> the lores he casts from, as `Lores` holds them."""
    return {
        (slug, fighter["name"]): [{"name": lore, "note": ""} for lore in fighter["spellLores"]]
        for slug, page in pages.items()
        for fighter in page["fighters"]
        if fighter.get("spellLores")
    }


def lines_of(page: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    """Every line a page names an item in, as (list, name, cost): its lists' lines, then its special equipment."""
    found = [
        (raw["title"], entry["name"], entry.get("cost") or {})
        for raw in page["equipmentLists"]
        for entry in raw["items"]
    ]
    found += [
        ("Special equipment", entry["title"], entry.get("cost") or {}) for entry in page.get("specialEquipment") or []
    ]
    return found


NO_COST = object()  # a stub or price row that gives no `cost` key takes its line's price


def _stub_cost(slug: str, page: dict[str, Any], name: str, own: Any = NO_COST) -> tuple[int | None, str]:
    """The price of a stub or a price row: its own `cost` where it has one, else the first line naming it ("3 ×
    price" and no cost for a line priced by its base item, the Druchii's Darksteel blade). A `cost` of null is a
    price of its own: none, for a page that prints an item with no price (the Khemri Bagh Nakh)."""
    if own is not NO_COST:
        return (own if isinstance(own, int) else None), ""
    for _list, line, cost in lines_of(page):
        price = line_price(cost)
        if loose_key(line) == loose_key(name) and (price.cost is not None or price.cost_note):
            return price.cost, price.cost_note
    raise ValueError(f"pdf-warbands/{slug}.json: no priced line names {name!r}")


def page_item_rules(pages: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """The shared item rules the pages bring (`itemRules`), in out/item-rules.json's shape: one rule, which several
    items link (the Metal Mongers' Experimental Technology, its Experimental Weapon chart a table)."""
    return [
        {
            "slug": slugify(row["name"]),
            "name": row["name"],
            "aliases": [],
            "summary": row.get("summary") or "",
            "text": row["text"],
            "tables": row.get("tables") or [],
            "used_by": 0,
            "wordings": 1,
        }
        for page in pages.values()
        for row in page.get("itemRules") or []
    ]


def _stub_rule(slug: str, stub: str, row: dict[str, Any], rules: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """A stub's rule as an item's rules hold it: a shared rule linked by name, in the item's own words where it gives
    them (the Ratling Gun's Save Modifier is -1, ours the handgun's -2), or its own rule."""
    if "rule" not in row:
        return {"name": row["name"], "summary": "", "text": row["text"], "tables": row.get("tables") or []}
    shared = rules.get(norm_name(row["rule"]))
    if shared is None:
        raise ValueError(f"pdf-warbands/{slug}.json: the stub {stub!r} links {row['rule']!r}, no shared item rule")
    return {"rule": shared["slug"], **{key: row[key] for key in ("summary", "text", "tables") if row.get(key)}}


def give_page_rules(pages: dict[str, dict[str, Any]], items: list[dict[str, Any]]) -> None:
    """Each page's shared item rule linked by our items it names (`ours`), in place of their own rules: the Watchmen's
    Map is our Mordheim Map's rule."""
    by_name = {item["name"]: item for item in items}
    for slug, page in pages.items():
        for row in page.get("itemRules") or []:
            for name in row.get("ours") or []:
                if name not in by_name:
                    raise ValueError(
                        f"pdf-warbands/{slug}.json: the shared rule {row['name']!r} names no item {name!r}"
                    )
                by_name[name]["rules"] = [{"rule": slugify(row["name"])}]


def row_types(slug: str, page: dict[str, Any], entry: dict[str, Any], known: set[str]) -> list[str]:
    """The warband types a price row serves: the ones it names (`types`: Sartosa's shop list, declared once for the
    setting's eleven), else the page's own."""
    found = list(entry.get("types") or [page[TYPE]])
    for name in found:
        if name not in known:
            raise ValueError(f"pdf-warbands/{slug}.json: the price row's {name!r} is no warband type")
    return found


def add_price_rows(pages: dict[str, dict[str, Any]], items: list[dict[str, Any]], types: list[dict[str, Any]]) -> None:
    """Each page's `priceRows` added to our items, or to a stub the batch declares (`stub_items` runs first, so the
    Sartosa shop's Throwing Axes row reaches the Dwarf Slayer Cult's stub): a row for the page's type, or for every
    type it names (`types`),
    at its line's price, with the rarity, dice, dice multiplier and note the PDF prints (the Low Kings' Spiked
    Gauntlet, 15 gc, Rare 7, Enforcer only; Sartosa's shop list, one row for its eleven warband types)."""
    index = ItemIndex(items)
    known = {row["slug"] for row in types}
    for slug, page in pages.items():
        for entry in page.get("priceRows") or []:
            item, _how = index.find(entry["name"])
            if item is None:
                raise ValueError(f"pdf-warbands/{slug}.json: the price row's {entry['name']!r} is no item of ours")
            price, note = _stub_cost(slug, page, entry["name"], entry.get("cost", NO_COST))
            cost = {
                "cost": price,
                "dice": entry.get("dice"),
                "dice_multiplier": entry.get("diceMultiplier"),
                "cost_note": note,
            }
            warbands = [{"type": name, "excluded": False} for name in row_types(slug, page, entry, known)]
            item["availabilities"].append(_row(cost, entry.get("rarity"), warbands, entry.get("note") or ""))


def stub_items(
    pages: dict[str, dict[str, Any]],
    items: list[dict[str, Any]],
    types: list[dict[str, Any]],
    rules: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Each page's stubs as items (out/items.json's shape): the rules it carries (`rules`: the shared ones by the
    index of their names), one price row for the page's type at its line's
    price, with the rarity and dice the PDF prints. A stub two pages declare (the Protectorate of Sigmar's Blessed
    Bolts, which the Vampire Hunters of Sylvania buy too) is one item with a row for each, made from the first by
    grade, then in the pages' order (the 2a Vampire Hunters' Scythe keeps its setting when the 2b Night Haint buy it
    too). A stub that names one of our items stops the build: link it. A stub's row serves every warband type it
    names (`types`), as a price row's does, so a setting's shop list declares an item it alone sells once (Sartosa's
    Duck-Footed Pistol, for the setting's eleven types)."""
    index = ItemIndex(items)
    by_slug = {row["slug"]: row for row in types}
    known = set(by_slug)
    stubs: list[dict[str, Any]] = []
    made: dict[str, dict[str, Any]] = {}
    in_order = sorted(pages.items(), key=lambda pair: by_slug[pair[1][TYPE]].get("broheim_grade") or "")
    for slug, page in in_order:
        warband = by_slug[page[TYPE]]
        for stub in page.get("stubs") or []:
            found, how = index.find(stub["name"])
            if found is not None:
                raise ValueError(f"pdf-warbands/{slug}.json: the stub {stub['name']!r} is our {found['name']!r} {how}")
            price, note = _stub_cost(slug, page, stub["name"], stub.get("cost", NO_COST))
            cost = {
                "cost": price,
                "dice": stub.get("dice"),
                "dice_multiplier": stub.get("diceMultiplier"),
                "cost_note": note,
            }
            buyers = [{"type": name, "excluded": False} for name in row_types(slug, page, stub, known)]
            row = _row(cost, stub.get("rarity"), buyers, "")
            if loose_key(stub["name"]) in made:
                made[loose_key(stub["name"])]["availabilities"].append(row)
                continue
            own = [_stub_rule(slug, stub["name"], entry, rules or {}) for entry in stub.get("rules") or []]
            item = _item(
                stub["name"],
                stub["type"],
                stub.get("subtype") or "",
                warband["setting"],
                page["source"],
                link_url=page["sourceLink"],
                range=stub.get("range") or "",
                strength=stub.get("strength") or "",
                rules=own,
                availabilities=[row],
            )
            note = stub.get("note") or ""
            needs = not any("rule" not in entry for entry in own)  # until it has a rule of its own
            made[loose_key(stub["name"])] = {
                **item,
                "save": stub.get("save") or "",
                "statblock": [{key: str(value) for key, value in row.items()} for row in stub.get("statblock") or []],
                "notes": note,
                "origin": ORIGIN,
                "needs_rules": needs,
            }
            stubs.append(made[loose_key(stub["name"])])
    return stubs


def _new_group(
    page: dict[str, Any], group: dict[str, Any], skills: list[dict[str, Any]], source: str, slugs: list[str]
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """A page's new skill group as overrides.json's `new_skill_groups` holds one, and its new skills' rules."""
    new = [row for row in skills if "description" in row]
    decision = {
        "types": slugs,
        "note": group.get("note") or "",
        "skills": [row["ours"] for row in skills if "ours" in row],
        "new_skills": [{"name": row["name"], "rule": row["name"]} for row in new],
        "source": source,
    }
    return decision, [{"name": row["name"], "description": row["description"], "source": page["source"]} for row in new]


def declared_groups(
    slug: str, page: dict[str, Any]
) -> list[tuple[dict[str, Any], list[dict[str, Any]], str, list[str]]]:
    """The new groups a page declares: its own (the Special tick's, for its type), then one it shares with other
    warband types (`sharedSkillGroup`). Each as (the group, its skills, the source key its rules take, its types)."""
    found = []
    own = page.get("skillGroup") or {}
    if own.get("new"):
        found.append((own, page.get("specialSkillsList") or [], f"pdf-warbands/{slug}.json", [page[TYPE]]))
    shared = page.get(SHARED) or {}
    if shared:
        source = f"pdf-warbands/{slug}.json ({shared['name']})"
        found.append((shared, shared.get("skills") or [], source, list(shared["types"])))
    return found


def skill_settings(pages: dict[str, dict[str, Any]], setting_of: dict[str, str]) -> dict[str, str]:
    """The setting each new skill belongs to: the earliest, by the settings' own order (`grading.SETTING_ORDER`), of
    the settings whose pages declare it. A skill two pages share is one skill (the Wood Elves' Elven Luck, the
    Slayers' Songster, the two Clan Pestilens warbands' Cloud of Flies), so it can sit in only one setting, and
    taking the earliest keeps that from depending on the order the files happen to be read in."""
    rank = {slug: order for order, slug in enumerate(SETTING_ORDER)}
    last = len(rank)
    found: dict[str, str] = {}
    for slug, page in pages.items():
        setting = setting_of[page[TYPE]]
        for _group, skills, _source, _slugs in declared_groups(slug, page):
            for row in skills:
                held = found.get(row["name"])
                if "description" in row and (held is None or rank.get(setting, last) < rank.get(held, last)):
                    found[row["name"]] = setting
    return found


def add_skill_groups(sources: Any, pages: dict[str, dict[str, Any]], types: list[dict[str, Any]]) -> None:
    """The pages' new skill groups, made as overrides.json's new groups are (new_groups.py): open to the page's type
    (a shared group to the types it names), their new skills' rules from the page, each skill in the earliest setting
    of the pages that declare it (`skill_settings`)."""
    setting_of = {row["slug"]: row["setting"] for row in types}
    settings = skill_settings(pages, setting_of)
    groups = dict(sources.overrides.get("new_skill_groups", {}))
    chosen = dict(sources.overrides.get("setting_assignments", {}).get("skills", {}))
    for slug, page in pages.items():
        for group, skills, source, slugs in declared_groups(slug, page):
            if group["name"] in groups:
                raise ValueError(f"pdf-warbands/{slug}.json: the skill group {group['name']!r} is made twice")
            groups[group["name"]], rows = _new_group(page, group, skills, source, slugs)
            sources.skill_files[source] = rows
            chosen.update({f"{row['name']} ({group['name']})": settings[row["name"]] for row in rows})
    assignments = {**sources.overrides.get("setting_assignments", {}), "skills": chosen}
    sources.overrides = {**sources.overrides, "new_skill_groups": groups, "setting_assignments": assignments}
