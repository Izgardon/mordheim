"""Lad's Got Talent: promoting a henchman to a hero in one transaction (decision 9, BUG-28, ROST-TWEAK-04).

It does what the client's four-request chain did, with the same field choices, but all or nothing: the new
hero copies the group's profile, XP, skills and specials and takes one copy of each of its items (the
henchman's share); he starts with two level-ups and spends one on the re-rolled advance. The henchman is
dismissed from the group (the group too if nobody living is left), the group's level-up is spent (the chain
left it unspent) and every step is logged. At the hero cap the caller may name a hero to dismiss to make
room; without one the promotion is refused with `hero_cap_reached`.
"""

from dataclasses import dataclass
from typing import Any, cast

from django.db import transaction
from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.warbands.models import Henchman, HenchmenGroup, HenchmenGroupItem, Hero, Warband, on_roster
from apps.warbands.units.errors import RosterError
from apps.warbands.units.kinds import HENCHMEN_GROUP, HERO, STAT_FIELD_BY_ADVANCE
from apps.warbands.utils.leaders import lock_warband

from .create import apply_create, check_cap
from .dismiss import dismiss
from .level_up import STAT_LABELS, LevelUpRejected, advance_record, apply_advance, spend_level_up

LADS_GOT_TALENT = {"id": "LGT", "label": "Lad's Got Talent"}


@dataclass(frozen=True)
class Promotion:
    hero: Hero
    group: HenchmenGroup | None  # None once the group has been dismissed (nobody living left)


def _field_error(field: str, message: str) -> RosterError:
    return RosterError(message, "invalid", {field: [message]})


def _promoted_name(henchman: Henchman, living: list[Henchman]) -> str:
    """The henchman's name, or "Henchman N" by his place in the group, as the dialog labelled him."""
    return henchman.name.strip() or f"Henchman {living.index(henchman) + 1}"


def _hero_fields(warband: Warband, group: HenchmenGroup, name: str, items: list[HenchmenGroupItem]) -> dict[str, Any]:
    """The new hero's create body: the group's profile, XP, skills and specials, his items, two level-ups."""
    specials = list(group.henchmen_group_specials.select_related("special").order_by("id"))
    special_names = {(link.special.name or "").strip().lower() for link in specials}
    caster = "Wizard" if "wizard" in special_names else "Priest" if "priest" in special_names else "No"
    return {
        "warband": warband,
        "name": name,
        "unit_type": group.unit_type,
        "race": group.race,
        "price": 0,
        "xp": group.xp,
        "level_up": 2,
        "deeds": group.deeds,
        "armour_save": group.armour_save,
        "large": group.large or "large" in special_names,
        "caster": caster,
        "half_rate": group.half_rate,
        **{field: getattr(group, field) for field in STAT_FIELD_BY_ADVANCE.values()},
        "items": [{"id": row.item_id, "cost": row.cost} for row in items],
        "skill_ids": list(group.henchmen_group_skills.order_by("id").values_list("skill_id", flat=True)),
        "special_ids": [link.special_id for link in specials],
        "spell_ids": [],
    }


def _his_share_of_items(group: HenchmenGroup) -> list[HenchmenGroupItem]:
    """One row of each item the group carries (the first by id): what the promoted henchman takes with him."""
    share: dict[int, HenchmenGroupItem] = {}
    for row in group.henchmen_group_items.order_by("id"):
        share.setdefault(row.item_id, row)
    return list(share.values())


def _spend_group_level_up(group: HenchmenGroup) -> None:
    """The group's level-up is the roll that came up Lad's Got Talent: spend it (BUG-28), or refuse."""
    record = advance_record(LADS_GOT_TALENT, STAT_LABELS)
    if group.no_level_ups or not spend_level_up(group, stat_field=None, record=record):
        raise RosterError("No level ups available", "no_level_ups")


def _make_room(warband: Warband, dismiss_hero_id: int | None) -> None:
    if dismiss_hero_id is None:
        return
    hero = HERO.visible(Hero.objects.filter(id=dismiss_hero_id, warband=warband)).first()
    if hero is None:
        raise _field_error("dismiss_hero_id", "Not a hero on this warband's roster.")
    dismiss(HERO, warband, hero)


def promote_henchman(warband: Warband, group: HenchmenGroup, request: dict[str, Any]) -> Promotion:
    """Promote `request["henchman_id"]`, spending `request["advance"]` (validated for heroes by the caller).

    `group` is read with its race. Raises RosterError, with everything rolled back, when refused.
    """
    with transaction.atomic():
        lock_warband(warband.id)  # leader changes and the cap count both run under it
        living = list(on_roster(group.henchmen.all()).order_by("id"))
        henchman = next((member for member in living if member.id == request["henchman_id"]), None)
        if henchman is None:
            raise _field_error("henchman_id", "Not a living member of this group.")
        _spend_group_level_up(group)
        _make_room(warband, request.get("dismiss_hero_id"))
        name = _promoted_name(henchman, living)
        items = _his_share_of_items(group)
        fields = _hero_fields(warband, group, name, items)
        check_cap(HERO, warband, fields, locked=True)
        hero = cast(Hero, apply_create(HERO, fields))
        HERO.hooks.record_recruit(HERO, warband, hero, {})
        advance = {"hero": name, "advance": request["advance"], **request.get("rolls", {})}
        try:
            apply_advance(HERO, warband, hero, advance, savepoint=False)
        except LevelUpRejected as rejected:
            raise _field_error("advance", rejected.detail) from None
        HenchmenGroupItem.objects.filter(id__in=[row.id for row in items]).delete()
        Henchman.objects.filter(id=henchman.id).update(dismissed_at=timezone.now())
        group_name = group.name or group.unit_type or "Henchmen Group"
        log_payload = {"group": group_name, "advance": LADS_GOT_TALENT, "lads_got_talent": True}
        log_payload |= {"henchman_id": henchman.id, "henchman_name": name, "hero_id": hero.id}
        log_warband_event(warband.id, "advance", HENCHMEN_GROUP.advance_log_type, log_payload)
        if len(living) == 1:
            dismiss(HENCHMEN_GROUP, warband, group)
            return Promotion(hero, None)
    return Promotion(hero, group)
