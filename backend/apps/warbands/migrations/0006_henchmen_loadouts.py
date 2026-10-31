from collections import Counter, defaultdict

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import F


def _living_members(apps) -> dict[int, list[int]]:
    """Each group on the roster -> its living members, oldest first."""
    group_model = apps.get_model("warbands", "HenchmenGroup")
    member_model = apps.get_model("warbands", "Henchman")
    on_roster = set(group_model.objects.filter(dead=False, dismissed_at__isnull=True).values_list("id", flat=True))
    living: dict[int, list[int]] = defaultdict(list)
    members = member_model.objects.filter(dead=False, dismissed_at__isnull=True, group_id__in=on_roster)
    for member_id, group_id in members.order_by("id").values_list("id", "group_id"):
        living[group_id].append(member_id)
    return living


def _to_stash(apps, extras: Counter) -> None:
    """Copies a loadout can't hold go to the stash at their costs, one row per item and cost."""
    stash_model = apps.get_model("warbands", "WarbandItem")
    for (warband_id, item_id, cost), quantity in extras.items():
        rows = stash_model.objects.filter(warband_id=warband_id, item_id=item_id)
        rows = rows.filter(cost__isnull=True) if cost is None else rows.filter(cost=cost)
        if not rows.update(quantity=F("quantity") + quantity):
            stash_model.objects.create(warband_id=warband_id, item_id=item_id, cost=cost, quantity=quantity)


def copies_to_loadout(apps, schema_editor) -> None:
    """A group's copies become its loadout: per item, one row for each full set of copies (at least one), the copies
    left over to the stash, and a gap on each of the last members a short group can't arm. A group off the roster
    keeps one row per item as its record."""
    row_model = apps.get_model("warbands", "HenchmenGroupItem")
    gap_model = apps.get_model("warbands", "HenchmanItemGap")
    living = _living_members(apps)
    copies: dict[tuple[int, int], list[tuple[int, int, int | None]]] = defaultdict(list)
    columns = ("id", "henchmen_group_id", "henchmen_group__warband_id", "item_id", "cost")
    for row_id, group_id, warband_id, item_id, cost in row_model.objects.order_by("-companion", "id").values_list(
        *columns
    ):
        copies[(group_id, item_id)].append((row_id, warband_id, cost))
    dropped: list[int] = []
    extras: Counter = Counter()
    gaps = []
    for (group_id, item_id), rows in copies.items():
        members = living.get(group_id, [])
        kept = max(1, len(rows) // len(members)) if members else 1
        dropped += [row_id for row_id, _warband_id, _cost in rows[kept:]]
        if not members:
            continue
        left_over = len(rows) - kept * len(members)
        for _row_id, warband_id, cost in rows[len(rows) - left_over :] if left_over > 0 else []:
            extras[(warband_id, item_id, cost)] += 1
        if left_over < 0:  # fewer copies than members: the last ones go without
            gaps += [gap_model(henchman_id=member, group_item_id=rows[0][0]) for member in members[left_over:]]
    row_model.objects.filter(id__in=dropped).delete()
    gap_model.objects.bulk_create(gaps)
    _to_stash(apps, extras)


class Migration(migrations.Migration):
    """Henchmen loadouts: a group's item rows say what every member carries, and a gap records a member who lacks one.
    Existing copies are folded into rows (copies_to_loadout)."""

    dependencies = [
        ("warbands", "0005_warband_drop_faction_restrictions"),
    ]

    operations = [
        migrations.CreateModel(
            name="HenchmanItemGap",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("short", "Joined or equipped without it"),
                            ("lost", "Lost after a battle"),
                            ("used", "Used up in a battle"),
                            ("kit_taken", "Kit taken to the stash"),
                        ],
                        default="short",
                        max_length=12,
                    ),
                ),
                ("left", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "group_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gaps",
                        to="warbands.henchmengroupitem",
                    ),
                ),
                (
                    "henchman",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_gaps",
                        to="warbands.henchman",
                    ),
                ),
            ],
            options={
                "db_table": "henchman_item_gap",
            },
        ),
        migrations.AddConstraint(
            model_name="henchmanitemgap",
            constraint=models.UniqueConstraint(fields=("henchman", "group_item"), name="unique_henchman_item_gap"),
        ),
        migrations.RunPython(copies_to_loadout, migrations.RunPython.noop),
    ]
