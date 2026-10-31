"""How hired swords and dramatis personae are read (PERF-46, PERF-49): a fixed number of queries whatever the list's
length or the kit's size.

A list reads each row with its race, and who may hire it (each line with its type or group) in one query. A detail
adds the skills, specials and spells (one query each, with the entries), the equipment links with their items, then
the items' rules, price rows (with their who-can lines) and, for an animal's item, its entry's specials. Lists,
details, a write's answer and a hire read through here.
"""

from typing import Any

from django.db.models import Model, Prefetch, QuerySet

from apps.core.catalogue.payloads import badge_joins
from apps.warbands.prefetches import item_detail_prefetches

LINK_TARGETS = (("skill_links", "skill"), ("special_links", "special"), ("spell_links", "spell"))


def link_model(model: type[Model], relation: str) -> Any:
    """The link table behind one of a hired sword's or dramatis persona's relations (e.g. HiredSwordSkill)."""
    return model._meta.get_field(relation).related_model


def owner_field(model: type[Model], relation: str) -> str:
    """The link table's foreign key to its hired sword or dramatis persona ("hired_sword", "dramatis_persona")."""
    field: Any = model._meta.get_field(relation)
    name: str = field.field.name
    return name


def links_with(model: type[Model], relation: str, target: str) -> Prefetch:
    """One relation's links in the order they were written, each with the entry it links."""
    return Prefetch(relation, queryset=link_model(model, relation).objects.select_related(target).order_by("id"))


def who_can_hire(model: type[Model]) -> Prefetch:
    """Who may hire an entry: its lines, each with its warband type or group."""
    lines = link_model(model, "warband_links").objects.select_related("warband_type", "warband_group").order_by("id")
    return Prefetch("warband_links", queryset=lines)


def profile_rows(rows: QuerySet[Any]) -> QuerySet[Any]:
    """Rows read for the list payload: their race, and who may hire them in one query."""
    return rows.select_related("race").prefetch_related(who_can_hire(rows.model))


def equipment(model: type[Model]) -> Prefetch:
    """The equipment links with their items read for the detail payload."""
    links = (
        link_model(model, "item_links")
        .objects.select_related("item__bestiary_entry")
        .prefetch_related(*item_detail_prefetches("item__"), "item__bestiary_entry__specials")
        .order_by("id")
    )
    return Prefetch("item_links", queryset=links)


def profile_details(model: type[Model]) -> QuerySet[Any]:
    """Rows read for the detail payload: a list row's reads and its skills, specials, spells and equipment."""
    rows: QuerySet[Any] = model._default_manager.select_related("race", *badge_joins())
    kit = [links_with(model, relation, target) for relation, target in LINK_TARGETS]
    return rows.prefetch_related(who_can_hire(model), *kit, equipment(model))
