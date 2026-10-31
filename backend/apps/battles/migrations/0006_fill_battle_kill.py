"""Fill battle_kill from the kill events (next step 9), so the data keeps its history; then drop the kill events'
killer index, which nothing reads any more (kill history reads battle_kill).

Each `unit_kill_recorded` event becomes one row, created when the event was:

- unit keys ("hero:12", "henchman:88", "hireling:3") map to their rows when the row is still in the payload's
  warband, else the key stays null (the unit was deleted); a henchman brings his group;
- a victim that isn't a row is a temporary unit (custom, bestiary or a pet: its key kept), a creature (its neutral
  key kept) or someone else (a typed name);
- names, types and the victim's traits come from the payload, as do the round (not for a kill added after the
  fight), the phase (the payload's `source`), how, the XP flag and whether the kill took its victim out of action;
- a voided event, or one a `unit_kill_voided` event names, gives a voided row.

A kill whose killer isn't one of a warband's own units (a pet, a temporary unit) or whose warband is gone is
skipped: finalise never counted those, as they have no unit to credit.
"""

from typing import Any

from django.db import migrations

KILLER_KINDS = ("hero", "henchman", "hireling")
TEMPORARY_PREFIXES = ("custom:", "bestiary:", "pet:")
HOWS = ("melee", "shooting", "magic", "other")
CASTERS = ("Wizard", "Priest")
OLD_INDEX = "battle_event_kill_killer_idx"


def _part(payload, name):
    part = payload.get(name) if isinstance(payload, dict) else None
    return part if isinstance(part, dict) else {}


def _id(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def _text(value, limit=120):
    return str(value or "").strip()[:limit]


class Rows:
    """The warbands and units the events name, read once: what still exists, and in which warband."""

    def __init__(self, apps, events):
        parts = [_part(event.payload_json, side) for event in events for side in ("killer", "victim")]
        wanted = {
            kind: {_id(part.get("unit_id")) for part in parts if part.get("unit_type") == kind} for kind in KILLER_KINDS
        }
        warband_ids = {_id(part.get("warband_id")) for part in parts}
        Warband = apps.get_model("warbands", "Warband")
        self.warbands = set(Warband.objects.filter(id__in=warband_ids - {None}).values_list("id", flat=True))
        heroes = apps.get_model("warbands", "Hero").objects.filter(id__in=wanted["hero"] - {None})
        self.heroes = dict(heroes.values_list("id", "warband_id"))
        henchmen = apps.get_model("warbands", "Henchman").objects.filter(id__in=wanted["henchman"] - {None})
        self.henchmen = {row[0]: row[1:] for row in henchmen.values_list("id", "group_id", "group__warband_id")}
        hirelings = apps.get_model("warbands", "Hireling").objects.filter(id__in=wanted["hireling"] - {None})
        self.hirelings = dict(hirelings.values_list("id", "warband_id"))

    def warband(self, part):
        warband_id = _id(part.get("warband_id"))
        return warband_id if warband_id in self.warbands else None

    def unit(self, prefix, part, warband_id):
        """The kind's unit keys for a hero, henchman or hired sword: the row's, when it is still in the warband."""
        kind, unit_id = part.get("unit_type"), _id(part.get("unit_id"))
        if kind == "hero":
            found = warband_id is not None and self.heroes.get(unit_id) == warband_id
            return {f"{prefix}_hero_id": unit_id if found else None}
        if kind == "hireling":
            found = warband_id is not None and self.hirelings.get(unit_id) == warband_id
            return {f"{prefix}_hireling_id": unit_id if found else None}
        group_id, group_warband_id = self.henchmen.get(unit_id, (None, None))
        found = warband_id is not None and group_warband_id == warband_id
        return {f"{prefix}_henchman_id": unit_id if found else None, f"{prefix}_group_id": group_id if found else None}


def _victim(rows, victim):
    """The victim's columns: a unit of a warband, a temporary unit, a creature or someone else."""
    traits = {
        "victim_name": _text(victim.get("name")),
        "victim_type": _text(victim.get("type_name")),
        "victim_leader": victim.get("is_leader") is True,
        "victim_large": victim.get("is_large") is True,
        "victim_caster": victim.get("caster_type") if victim.get("caster_type") in CASTERS else "",
    }
    unit_key = victim.get("unit_key") if isinstance(victim.get("unit_key"), str) else ""
    if isinstance(victim.get("neutral_key"), str) and victim["neutral_key"]:
        return {**traits, "victim_kind": "creature", "victim_key": victim["neutral_key"]}
    warband_id = rows.warband(victim)
    if victim.get("unit_type") in KILLER_KINDS:
        unit = rows.unit("victim", victim, warband_id)
        return {**traits, **unit, "victim_kind": victim["unit_type"], "victim_warband_id": warband_id}
    if unit_key.startswith(TEMPORARY_PREFIXES):
        return {**traits, "victim_kind": "temporary", "victim_key": unit_key, "victim_warband_id": warband_id}
    return {**traits, "victim_kind": "someone_else"}


def _kill(rows, event, voided_at):
    """The event's row, or None for a kill no warband's own unit scored."""
    payload = event.payload_json if isinstance(event.payload_json, dict) else {}
    killer = _part(payload, "killer")
    warband_id = rows.warband(killer)
    if killer.get("unit_type") not in KILLER_KINDS or warband_id is None:
        return None
    after = payload.get("source") == "postbattle"
    round_number = _id(payload.get("round"))
    return {
        "battle_id": event.battle_id,
        "campaign_id": event.battle.campaign_id,
        "event_id": event.id,
        "round": None if after else round_number,
        "phase": "after" if after else "fight",
        "how": payload.get("how") if payload.get("how") in HOWS else None,
        "earns_xp": payload.get("earned_xp") is not False,
        "took_out_victim": payload.get("victim_ooa") is True,
        "voided_at": event.voided_at or voided_at,
        "created_at": event.created_at,
        "killer_warband_id": warband_id,
        "killer_kind": killer["unit_type"],
        **rows.unit("killer", killer, warband_id),
        "killer_name": _text(killer.get("name")),
        "killer_type": _text(killer.get("type_name")),
        "killer_leader": killer.get("is_leader") is True,
        **_victim(rows, _part(payload, "victim")),
    }


def fill(apps, schema_editor):
    BattleEvent = apps.get_model("battles", "BattleEvent")
    BattleKill = apps.get_model("battles", "BattleKill")
    events = list(
        BattleEvent.objects.filter(type="unit_kill_recorded", kill__isnull=True).select_related("battle").order_by("id")
    )
    if not events:
        return
    voids: dict[int, Any] = {}
    for void in BattleEvent.objects.filter(type="unit_kill_voided").order_by("id"):
        target = _id((void.payload_json or {}).get("voided_event_id"))
        if target is not None:
            voids.setdefault(target, void.created_at)
    rows = Rows(apps, events)
    kills = [_kill(rows, event, voids.get(event.id)) for event in events]
    BattleKill.objects.bulk_create([BattleKill(**kill) for kill in kills if kill is not None], batch_size=500)


def empty(apps, schema_editor):
    apps.get_model("battles", "BattleKill").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0005_battle_kill"),
    ]

    operations = [
        migrations.RunPython(fill, empty),
        migrations.RunSQL(
            sql=f"DROP INDEX IF EXISTS {OLD_INDEX}",
            reverse_sql=(
                f"CREATE INDEX {OLD_INDEX} ON battle_event "
                "((payload_json #> '{killer,unit_type}'), (payload_json #> '{killer,unit_id}')) "
                "WHERE type = 'unit_kill_recorded'"
            ),
        ),
    ]
