"""The editor's checks (the templates plan, phase 4, "Warnings, never blocks"): what a template's author would
otherwise get wrong, each a warning by section (and by fighter or list key), never a refusal.

- Basics: it serves no warband type, so no warband uses it; a type another template in the campaign serves too (the
  campaign's own come first, the oldest first, so one of them isn't used for that type).
- Fighters: no leader; a fighter with no list and no fixed kit; more heroes than the campaign's hero cap.
- Lists: a list nobody buys from.
"""

from collections import defaultdict
from typing import Any

from django.db.models import F

from ..models import HERO, WarbandTemplate, WarbandTemplateType
from .resolve import in_campaign

NO_KIT = 'No list and no fixed kit: say "None" if they carry nothing.'


def _warning(section: str, text: str, key: str = "") -> dict[str, str]:
    return {"section": section, "key": key, "text": text}


def _shared_types(template: WarbandTemplate, campaign_id: int) -> list[dict[str, str]]:
    """Each type the template serves that another template in the campaign serves too (one query)."""
    type_ids = [link.warband_type_id for link in template.type_links.all()]
    if not type_ids:
        return [_warning("basics", "It serves no warband type, so no warband uses it.")]
    links = (
        WarbandTemplateType.objects.filter(warband_type_id__in=type_ids, template__in=in_campaign(campaign_id))
        .select_related("template", "warband_type")
        .order_by(F("template__campaign_id").asc(nulls_last=True), "template_id")
    )
    serving: dict[int, list[WarbandTemplateType]] = defaultdict(list)
    for link in links:
        serving[link.warband_type_id].append(link)
    found = []
    for rows in serving.values():
        others = [row.template for row in rows if row.template_id != template.pk]
        if len(rows) < 2 or not others:
            continue
        first, kind = rows[0].template, rows[0].warband_type.name
        names = ", ".join(_named(other) for other in others)
        text = (
            f"{kind}: {names} serves them too; this one comes first."
            if first.pk == template.pk
            else f"{kind}: {names} serves them too and comes first, so this one isn't used for them."
        )
        found.append(_warning("basics", text))
    return found


def _named(template: WarbandTemplate) -> str:
    return f"the book's {template.name}" if template.campaign_id is None else template.name


def _heroes(template: WarbandTemplate, hero_cap: int | None) -> list[dict[str, str]]:
    heroes = [fighter for fighter in template.fighters.all() if fighter.kind == HERO]
    if hero_cap is None or not heroes:
        return []
    endless = next((hero for hero in heroes if hero.max_count is None), None)
    if endless is not None:
        return [_warning("fighters", f"{endless.name} has no most; the campaign allows {hero_cap} heroes.")]
    most = sum(hero.max_count or 0 for hero in heroes)
    if most > hero_cap:
        return [_warning("fighters", f"Up to {most} heroes; the campaign allows {hero_cap}.")]
    return []


def template_warnings(template: WarbandTemplate, campaign_id: int, hero_cap: int | None) -> list[dict[str, str]]:
    """The template's warnings (its fighters, their lists and its lists prefetched: one more query, for the types)."""
    fighters = list(template.fighters.all())
    found: list[dict[str, Any]] = _shared_types(template, campaign_id)
    if fighters and not any(fighter.is_leader for fighter in fighters):
        found.append(_warning("fighters", "No fighter is the leader."))
    found += _heroes(template, hero_cap)
    found += [
        _warning("fighters", NO_KIT, fighter.key)
        for fighter in fighters
        if not fighter.list_links.all() and not fighter.fixed_kit.strip()
    ]
    used = {link.equipment_list_id for fighter in fighters for link in fighter.list_links.all()}
    found += [_warning("lists", "Nobody buys from it.", row.key) for row in template.lists.all() if row.pk not in used]
    return found
