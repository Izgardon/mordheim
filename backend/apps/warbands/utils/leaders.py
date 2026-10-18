from collections.abc import Sequence

from apps.warbands.models import Hero, Warband, on_roster


def lock_warband(warband_id: int) -> None:
    """Lock the warband row until the transaction ends, so leader changes to one warband run one at a time.

    Writes that can move the crown take this lock before they touch a hero, so they always lock in the
    same order (warband, then heroes) and two of them can't leave two leaders behind (BUG-63).
    """
    Warband.objects.select_for_update().filter(id=warband_id).values_list("id", flat=True).first()


def choose_leader(living_heroes: Sequence[Hero], preferred_leader_id: int | None = None) -> int | None:
    """Who leads, of the warband's living heroes in id order: the preferred hero when he is alive, else the living
    leader, else the first; None when no hero is alive. Postbattle applies it to the heroes it holds."""
    living_ids = [hero.id for hero in living_heroes]
    if not living_ids:
        return None
    if preferred_leader_id in living_ids:
        return preferred_leader_id
    return next((hero.id for hero in living_heroes if hero.is_leader), living_ids[0])


def ensure_single_living_leader(warband_id: int, preferred_leader_id: int | None = None) -> None:
    """Leave exactly one living leader when the warband has living heroes, none otherwise.

    Dead and dismissed heroes never keep the crown. Must run inside a transaction: it holds the warband
    lock while it reads and rewrites the crown.
    """
    lock_warband(warband_id)
    living_heroes = list(on_roster(Hero.objects.filter(warband_id=warband_id)).order_by("id"))
    leader_id = choose_leader(living_heroes, preferred_leader_id)
    if leader_id is None:
        Hero.objects.filter(warband_id=warband_id, is_leader=True).update(is_leader=False)
        return
    Hero.objects.filter(warband_id=warband_id, is_leader=True).exclude(id=leader_id).update(is_leader=False)
    Hero.objects.filter(id=leader_id).exclude(is_leader=True).update(is_leader=True)
