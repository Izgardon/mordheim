"""Lad's Got Talent: promoting a henchman to a hero in one transaction (decision 9, BUG-28, ROST-TWEAK-04).

All or nothing: the new hero copies the group's profile, XP, skills and specials and takes one copy of each loadout
row he carries (his share, less his gaps; the group's rows stay: services/loadouts.py). He joins with one advance to
take later on his card, none taken now (William, 3 Nov 2026: "we dont then level up that new hero then and there, they
should just get a pending advance"). The henchman is dismissed from the group (the group too if nobody living is
left) and every step is logged. The group keeps its level-up: the talent is recorded in its history and the rest of
the group rolls the advance again ("offer for you to roll again normally for the rest of the group"), which can't come
up the talent while that record is the last (`talent_used`). At the hero cap the caller may name a hero to dismiss to
make room; without one the promotion is refused with `hero_cap_reached`.
"""

from dataclasses import dataclass
from typing import Any, cast

from django.db import transaction
from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.warbands.models import Henchman, HenchmenGroup, HenchmenGroupItem, Hero, Warband, on_roster
from apps.warbands.services.loadouts import carried_rows
from apps.warbands.units.errors import RosterError
from apps.warbands.units.kinds import HENCHMEN_GROUP, HERO
from apps.warbands.utils.leaders import lock_warband
from apps.warbands.utils.stats import stat_values

from .create import apply_create, check_cap
from .dismiss import dismiss
from .level_up import STAT_LABELS, advance_record, record_without_spending

LADS_GOT_TALENT = {"id": "LGT", "label": "Lad's Got Talent"}
TALENT_USED = "The lad's got talent already came up on this advance: roll the group's advance again."


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
    """The new hero's create body: the group's profile, XP, skills and specials, his items, one advance to take."""
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
        "level_up": 1,
        "deeds": group.deeds,
        "armour_save": group.armour_save,
        "large": group.large or "large" in special_names,
        "caster": caster,
        "half_rate": group.half_rate,
        **stat_values(group),
        "items": [{"id": row.item_id, "cost": row.cost, "companion": row.companion} for row in items],
        "skill_ids": list(group.henchmen_group_skills.order_by("id").values_list("skill_id", flat=True)),
        "special_ids": [link.special_id for link in specials],
        "spell_ids": [],
    }


def _take_the_talent(group: HenchmenGroup) -> None:
    """The group's level-up came up Lad's Got Talent: record it and keep the level-up for the rest of the group's
    roll, or refuse when there is none or the talent already came up on it (the last record is the talent)."""
    group.refresh_from_db(fields=["level_up", "no_level_ups", "level_up_history"])  # read under the warband's lock
    history = group.level_up_history or []
    if history and isinstance(history[-1], dict) and history[-1].get("code") == LADS_GOT_TALENT["id"]:
        raise RosterError(TALENT_USED, "talent_used")
    record = advance_record(LADS_GOT_TALENT, STAT_LABELS)
    if group.no_level_ups or not record_without_spending(group, record):
        raise RosterError("No level ups available", "no_level_ups")


def _make_room(warband: Warband, dismiss_hero_id: int | None) -> None:
    if dismiss_hero_id is None:
        return
    hero = HERO.visible(Hero.objects.filter(id=dismiss_hero_id, warband=warband)).first()
    if hero is None:
        raise _field_error("dismiss_hero_id", "Not a hero on this warband's roster.")
    dismiss(HERO, warband, hero)


def promote_henchman(warband: Warband, group: HenchmenGroup, request: dict[str, Any]) -> Promotion:
    """Promote `request["henchman_id"]` to a hero with one advance to take, keeping the group's level-up.

    `group` is read with its race. Raises RosterError, with everything rolled back, when refused.
    """
    with transaction.atomic():
        lock_warband(warband.id)  # leader changes and the cap count both run under it
        living = list(on_roster(group.henchmen.all()).order_by("id"))
        henchman = next((member for member in living if member.id == request["henchman_id"]), None)
        if henchman is None:
            raise _field_error("henchman_id", "Not a living member of this group.")
        _take_the_talent(group)
        _make_room(warband, request.get("dismiss_hero_id"))
        name = _promoted_name(henchman, living)
        items = carried_rows(henchman)  # his share: a copy of each row, still riding what he rode
        fields = _hero_fields(warband, group, name, items)
        check_cap(HERO, warband, fields, locked=True)
        hero = cast(Hero, apply_create(HERO, fields))
        HERO.hooks.record_recruit(HERO, warband, hero, {})
        Henchman.objects.filter(id=henchman.id).update(dismissed_at=timezone.now())
        group_name = group.name or group.unit_type or "Henchmen Group"
        log_payload = {"group": group_name, "advance": LADS_GOT_TALENT, "lads_got_talent": True}
        log_payload |= {"henchman_id": henchman.id, "henchman_name": name, "hero_id": hero.id}
        log_warband_event(warband.id, "advance", HENCHMEN_GROUP.advance_log_type, log_payload)
        if len(living) == 1:
            dismiss(HENCHMEN_GROUP, warband, group)
            return Promotion(hero, None)
    return Promotion(hero, group)
