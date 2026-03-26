from apps.warbands.models import Hero


def ensure_single_living_leader(warband_id: int, preferred_leader_id: int | None = None) -> None:
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
