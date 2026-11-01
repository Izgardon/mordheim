"""Number the battles played before battles had a number (services/numbering.py has the rule).

Each battle that counts as a game, in the order it became one, gets the most games any of its warbands had played,
plus one, and each of its warbands counts it:

- a normal battle when it started (not cancelled);
- a reported result when its last player approved it (the latest `confirmed_at` among its players; its ended_at,
  the date it was played, when none is recorded).

Its players are those who didn't decline, leave before the start or refuse it, and weren't taken off the record.
Battles not played yet (invitations, pre-battles, reported results waiting for answers) then get the number they
would have now, as a new battle does. A cancelled battle gets none. Running it again gives the same numbers.
"""

from collections import Counter, defaultdict
from datetime import datetime

from django.db import migrations

LEFT = ("canceled_prebattle", "declined", "reported_result_declined")


def number_battles(apps, schema_editor):
    Battle = apps.get_model("battles", "Battle")
    BattleParticipant = apps.get_model("battles", "BattleParticipant")
    warbands = defaultdict(list)
    approved: dict[int, datetime] = {}
    rows = BattleParticipant.objects.filter(removed_from_record=False).exclude(status__in=LEFT)
    for battle_id, warband_id, confirmed_at in rows.values_list("battle_id", "warband_id", "confirmed_at"):
        warbands[battle_id].append(warband_id)
        if confirmed_at and (battle_id not in approved or confirmed_at > approved[battle_id]):
            approved[battle_id] = confirmed_at
    played, waiting = [], []
    for battle in Battle.objects.exclude(status="canceled").order_by("id"):
        if battle.flow_type == "normal" and battle.started_at:
            played.append((battle.started_at, battle.id, battle))
        elif battle.flow_type == "reported_result" and battle.status == "ended":
            played.append((approved.get(battle.id) or battle.ended_at or battle.created_at, battle.id, battle))
        else:
            waiting.append(battle)
    games: Counter = Counter()
    for _, _, battle in sorted(played, key=lambda row: (row[0], row[1])):
        ids = set(warbands.get(battle.id, ()))
        battle.number = max((games[warband_id] for warband_id in ids), default=0) + 1
        games.update(ids)
    for battle in waiting:
        battle.number = max((games[warband_id] for warband_id in set(warbands.get(battle.id, ()))), default=0) + 1
    Battle.objects.bulk_update([row[2] for row in played] + waiting, ["number"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0007_battle_number"),
    ]

    operations = [
        migrations.RunPython(number_battles, migrations.RunPython.noop),
    ]
