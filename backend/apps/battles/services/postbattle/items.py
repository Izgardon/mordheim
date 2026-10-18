"""Single-use items used in battle are used up when the player finalises or skips postbattle (BUG-72).

Each live `item_used` event of the player's removes one copy of the item from the unit that used it (a henchman
uses his group's); an undone use keeps the item (decision 5). Item rows are locked before they are deleted.
"""

from collections import Counter
from collections.abc import Iterable

from apps.items.models import Item
from apps.warbands.models import Henchman, HenchmenGroupItem, HeroItem, HiredSwordItem

from ...models import Battle, BattleEvent, BattleParticipant
from ...validation.coerce import coerce_int
from ...validation.unit_keys import parse_unit_key

ITEM_UNIT_TYPES = {"hero", "hired_sword", "henchman"}

Usage = Counter[tuple[str, int, int]]  # (unit type, unit id, item id) -> uses


def item_use_payloads(battle: Battle, participant: BattleParticipant) -> Iterable[object]:
    return BattleEvent.objects.filter(
        battle_id=battle.id,
        actor_user_id=participant.user_id,
        type=BattleEvent.TYPE_ITEM_USED,
        voided_at__isnull=True,  # an undone use keeps the item (decision 5)
    ).values_list("payload_json", flat=True)


def _usage(payloads: Iterable[object]) -> Usage:
    usage: Usage = Counter()
    for payload in payloads:
        if not isinstance(payload, dict):
            continue
        unit_key = payload.get("unit_key")
        if not isinstance(unit_key, str) or not unit_key.strip():
            continue
        try:
            item_id = coerce_int(payload.get("item_id"), field_name="item_id", minimum=1)
            parsed_unit = parse_unit_key(unit_key)
        except ValueError:
            continue
        if parsed_unit["unit_type"] in ITEM_UNIT_TYPES and parsed_unit["unit_id"] is not None:
            usage[(parsed_unit["unit_type"], parsed_unit["unit_id"], item_id)] += 1
    return usage


def _item_rows(unit_type: str, unit_id: int, warband_id: int, group_ids: dict[int, int]):
    if unit_type == "hero":
        return HeroItem.objects.filter(hero_id=unit_id, hero__warband_id=warband_id)
    if unit_type == "hired_sword":
        return HiredSwordItem.objects.filter(hired_sword_id=unit_id, hired_sword__warband_id=warband_id)
    group_id = group_ids.get(unit_id)
    if not group_id:
        return None
    return HenchmenGroupItem.objects.filter(henchmen_group_id=group_id, henchmen_group__warband_id=warband_id)


def consume_single_use_items(
    battle: Battle, participant: BattleParticipant, payloads: Iterable[object] | None = None
) -> None:
    """Remove one copy per live use of each single-use item the player used (`payloads`: his item_used events'
    payloads, read here when not given)."""
    usage = _usage(item_use_payloads(battle, participant) if payloads is None else payloads)
    if not usage:
        return
    single_use = set(
        Item.objects.filter(id__in={item_id for _, _, item_id in usage}, single_use=True).values_list("id", flat=True)
    )
    if not single_use:
        return
    henchman_ids = {unit_id for unit_type, unit_id, _ in usage if unit_type == "henchman"}
    group_ids = dict(
        Henchman.objects.filter(id__in=henchman_ids, group__warband_id=participant.warband_id).values_list(
            "id", "group_id"
        )
    )
    for (unit_type, unit_id, item_id), count in usage.items():
        if item_id not in single_use or count <= 0:
            continue
        rows = _item_rows(unit_type, unit_id, participant.warband_id, group_ids)
        if rows is None:
            continue
        row_ids = list(
            rows.select_for_update(of=("self",))
            .filter(item_id=item_id)
            .order_by("id")
            .values_list("id", flat=True)[:count]
        )
        if row_ids:
            rows.model.objects.filter(id__in=row_ids).delete()
