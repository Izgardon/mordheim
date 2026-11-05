"""The rules a template's fighters have and its upgrades give, as specials (the templates plan, phase 4): one picked
from the catalogue, or one written in the editor, which is the campaign's own and typed by the template ("Warband -
Night Watch") with the owner kind warband, as the import's fighter rules are, so the Boons & Banes pickers leave it
out; its category (its icon) is the one picked, else the book's rule for it (an upgrade in the Possessed's Mutations is a
mutation: special/categories.py). A written rule whose name the template's type already holds is refused: pick that
one instead."""

from collections.abc import Sequence
from typing import Any

from apps.core.errors import ApiError
from apps.special.categories import book_category
from apps.special.kinds import TRAIT, WARBAND
from apps.special.models import Special

from ..models import WarbandTemplate

NAME_TAKEN = "{name} is already one of {template}'s rules: pick it from the list instead."


def special_type(template: WarbandTemplate) -> str:
    return f"Warband - {template.name}"


def specials_for(template: WarbandTemplate, rules: Sequence[dict[str, Any]]) -> list[int]:
    """Each rule sent as a special's id: `{"special_id"}` picked (the campaign's current entry), or `{"name",
    "description", "kind"}` written, made here in one INSERT after one query for the names taken."""
    drafts: dict[str, dict[str, Any]] = {}
    for rule in rules:
        if "special_id" not in rule:
            drafts.setdefault(rule["name"].strip(), rule)
    made: dict[str, Special] = {}
    if drafts:
        assert template.campaign_id is not None  # the editor writes a campaign's template, never the book's
        kind = special_type(template)
        clash = Special.objects.filter(
            campaign_id=template.campaign_id, campaign_type__isnull=True, type=kind, name__in=list(drafts)
        ).first()
        if clash is not None:
            detail = NAME_TAKEN.format(name=clash.name, template=template.name)
            raise ApiError(detail, code="name_taken", fields={"rules": [detail]}, special_id=clash.pk)
        rows = Special.objects.bulk_create(
            Special(
                campaign_id=template.campaign_id,
                name=name,
                type=kind,
                owner_kind=WARBAND,
                kind=draft.get("kind") or TRAIT,
                category=draft.get("category") or book_category(name, kind, draft.get("group", "")),
                description=draft.get("description", ""),
            )
            for name, draft in drafts.items()
        )
        made = {row.name: row for row in rows}
    return [rule["special_id"] if "special_id" in rule else made[rule["name"].strip()].pk for rule in rules]
