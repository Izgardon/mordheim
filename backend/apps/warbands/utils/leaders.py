from apps.warbands.models import Hero, Warband


def lock_warband(warband_id: int) -> None:
    """Lock the warband row until the transaction ends, so leader changes to one warband run one at a time.

    Writes that can move the crown take this lock before they touch a hero, so they always lock in the
    same order (warband, then heroes) and two of them can't leave two leaders behind (BUG-63).
    """
    Warband.objects.select_for_update().filter(id=warband_id).values_list("id", flat=True).first()


def ensure_single_living_leader(warband_id: int, preferred_leader_id: int | None = None) -> None:
    """Leave exactly one living leader when the warband has living heroes, none otherwise.

    Must run inside a transaction: it holds the warband lock while it reads and rewrites the crown.
    """
    lock_warband(warband_id)
    living_heroes = list(Hero.objects.filter(warband_id=warband_id, dead=False).order_by("id"))
    if not living_heroes:
        Hero.objects.filter(warband_id=warband_id, is_leader=True).update(is_leader=False)
        return

    living_ids = [hero.id for hero in living_heroes]
    if preferred_leader_id in living_ids:
        leader_id = preferred_leader_id
    else:
        leader_id = next((hero.id for hero in living_heroes if hero.is_leader), living_ids[0])

    Hero.objects.filter(warband_id=warband_id, is_leader=True).exclude(id=leader_id).update(is_leader=False)
    Hero.objects.filter(id=leader_id).exclude(is_leader=True).update(is_leader=True)
