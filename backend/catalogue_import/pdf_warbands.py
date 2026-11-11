"""Warband templates read from the warbands' PDFs (William, 5 Nov 2026: "lets begin adding warbands in via their pdfs
... start in small batches so we can vet"): one source file per warband in `sources/pdf-warbands/`, written by hand
from its PDF in the snapshot's page shape (`snapshot.py`) with the rules in our own words, and loaded beside the
snapshot so the template import builds it the same way. A file's own keys:

- `warbandType`: the slug of our warband type it serves (the file is named after it; nothing is matched by name);
  the template's setting and grade are the type's;
- `aliases`: `{pdf, ours, page}`, a line's name as the PDF spells it and our item's name or tag it means
  ("Doubled-handed weapon" is a Double-handed weapon), put right as the file loads;
- `stubs`: `{name, type, subtype, rarity, dice, rulesPage, note}`, items a line names that we lack (William: "yes to
  stubs"): each a bare item, no rules, with one price row for its warband only at the line's price (`cost`: the price
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
- `priceRows`: `{name, rarity, dice, note, page, types}`, a price row for the page's type on one of our items its lines
  sell (the Low Kings' Spiked Gauntlet: William, 6 Nov 2026, "would prefer them being just one item"), at the line's
  price, or at its own `cost` for an item no line sells (the Wasteland Privateers' Superior Blackpowder, Rare 5 for
  them: William, 11 Nov 2026, "make superior gunpowder our blackpowder in a new price row"). `types`, the warband type
  slugs it serves (the page's own among them), is one row for several types: a setting's shop list is declared once
  (Sartosa's, on `sartosan-pirates.json`, for its eleven types) rather than copied into each page;
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
- `flags`: `{page, what}`, what the PDF leaves unclear, for William.

`check_pdf.py` checks every file against the catalogue (`pdf_check.py`).
"""

from html import escape
from pathlib import Path
from typing import Any

from catalogue_import.common import load_json, loose_key, norm_name, slugify
from catalogue_import.sources import SOURCES
from catalogue_import.template_lists import ItemIndex, line_price
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


def add_pages(pages: dict[str, dict[str, Any]], pdf: dict[str, dict[str, Any]]) -> None:
    """The PDF pages beside the snapshot's, which keep their slugs."""
    taken = sorted(set(pages) & set(pdf))
    if taken:
        raise ValueError(f"pdf-warbands: {', '.join(taken)} is a snapshot page too")
    pages.update(pdf)


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


def _stub_cost(slug: str, page: dict[str, Any], name: str, own: int | None = None) -> tuple[int | None, str]:
    """The price of a stub or a price row: its own `cost` where it has one, else the first line naming it ("3 ×
    price" and no cost for a line priced by its base item, the Druchii's Darksteel blade)."""
    if own is not None:
        return own, ""
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
    """Each page's `priceRows` added to our items: a row for the page's type, or for every type it names (`types`),
    at its line's price, with the rarity, dice, dice multiplier and note the PDF prints (the Low Kings' Spiked
    Gauntlet, 15 gc, Rare 7, Enforcer only; Sartosa's shop list, one row for its eleven warband types)."""
    index = ItemIndex(items)
    known = {row["slug"] for row in types}
    for slug, page in pages.items():
        for entry in page.get("priceRows") or []:
            item, _how = index.find(entry["name"])
            if item is None:
                raise ValueError(f"pdf-warbands/{slug}.json: the price row's {entry['name']!r} is no item of ours")
            price, note = _stub_cost(slug, page, entry["name"], entry.get("cost"))
            cost = {"cost": price, "dice": entry.get("dice"), "dice_multiplier": None, "cost_note": note}
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
    too). A stub that names one of our items stops the build: link it."""
    index = ItemIndex(items)
    by_slug = {row["slug"]: row for row in types}
    stubs: list[dict[str, Any]] = []
    made: dict[str, dict[str, Any]] = {}
    in_order = sorted(pages.items(), key=lambda pair: by_slug[pair[1][TYPE]].get("broheim_grade") or "")
    for slug, page in in_order:
        warband = by_slug[page[TYPE]]
        for stub in page.get("stubs") or []:
            found, how = index.find(stub["name"])
            if found is not None:
                raise ValueError(f"pdf-warbands/{slug}.json: the stub {stub['name']!r} is our {found['name']!r} {how}")
            price, note = _stub_cost(slug, page, stub["name"], stub.get("cost"))
            cost = {"cost": price, "dice": stub.get("dice"), "dice_multiplier": None, "cost_note": note}
            row = _row(cost, stub.get("rarity"), [{"type": warband["slug"], "excluded": False}], "")
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


def add_skill_groups(sources: Any, pages: dict[str, dict[str, Any]], types: list[dict[str, Any]]) -> None:
    """The pages' new skill groups, made as overrides.json's new groups are (new_groups.py): open to the page's type
    (a shared group to the types it names), their new skills' rules from the page, in the type's setting."""
    setting_of = {row["slug"]: row["setting"] for row in types}
    groups = dict(sources.overrides.get("new_skill_groups", {}))
    chosen = dict(sources.overrides.get("setting_assignments", {}).get("skills", {}))
    for slug, page in pages.items():
        for group, skills, source, slugs in declared_groups(slug, page):
            if group["name"] in groups:
                raise ValueError(f"pdf-warbands/{slug}.json: the skill group {group['name']!r} is made twice")
            groups[group["name"]], rows = _new_group(page, group, skills, source, slugs)
            sources.skill_files[source] = rows
            chosen.update({f"{row['name']} ({group['name']})": setting_of[page[TYPE]] for row in rows})
    assignments = {**sources.overrides.get("setting_assignments", {}), "skills": chosen}
    sources.overrides = {**sources.overrides, "new_skill_groups": groups, "setting_assignments": assignments}


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def render_pdf(pages: dict[str, dict[str, Any]], stubs: list[dict[str, Any]]) -> str:
    """The import report's PDF warbands section: each page's type, aliases, stubs and flags, for William's vetting."""
    lines = [
        "## PDF warbands",
        "",
        f"{len(pages)} warbands read from their PDFs (`sources/pdf-warbands/`), built as templates beside the snapshot's.",
        "",
        "| Page | Type | Fighters | Aliases | Stubs | Flags |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for slug, page in pages.items():
        counts = [len(page["fighters"]), len(page.get("aliases") or []), len(page.get("stubs") or [])]
        lines.append(f"| {slug} | {page[TYPE]} | {' | '.join(map(str, counts))} | {len(page.get('flags') or [])} |")
    prices = {
        (item["name"], warband["type"]): row
        for item in stubs
        for row in item["availabilities"]
        for warband in row["warbands"]
    }
    for page in pages.values():
        lines += ["", f"### {page['name']}", ""]
        for row in page.get("aliases") or []:
            lines.append(f'- Alias (p{row["page"]}): "{_cell(row["pdf"])}" is our {_cell(row["ours"])}.')
        for stub in page.get("stubs") or []:
            price = prices[(stub["name"], page[TYPE])]
            rarity = f"Rare {price['rarity']}" if price["rarity"] else "Common"
            dice = f"+{price['dice']}D6" if price["dice"] else ""
            cost = price["cost_note"] if price["cost"] is None else f"{price['cost']}{dice} gc"
            lines.append(f"- Stub: {stub['name']}, {cost}, {rarity}; its rules are on p{stub['rulesPage']}.")
        for row in page.get("itemRules") or []:
            lines.append(f"- Shared item rule (p{row['page']}): {_cell(row['name'])}.")
        for row in page.get("priceRows") or []:
            rarity = f"Rare {row['rarity']}" if row.get("rarity") else "Common"
            note = f", {_cell(row['note'])}" if row.get("note") else ""
            who = ", ".join(row.get("types") or [page[TYPE]])
            lines.append(f"- Price row (p{row['page']}): our {_cell(row['name'])} for {who}, {rarity}{note}.")
        for flag in page.get("flags") or []:
            lines.append(f"- Flag (p{flag['page']}): {_cell(flag['what'])}")
    return "\n".join(lines) + "\n"
