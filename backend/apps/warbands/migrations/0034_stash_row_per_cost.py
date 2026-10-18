# The stash keeps each copy's cost (BUG-117): one row per warband, item and cost instead of one per item. An
# unknown cost (NULL) counts as one cost (NULLS NOT DISTINCT, PostgreSQL 15+). Existing rows already satisfy the
# new constraint (they are unique per item), so nothing is rewritten; the new unique index is built on a small
# table. Reversing merges each item's rows back into one (keeping the newest row's cost, as the stash used to re-
# price) before the old constraint returns.

from typing import Any

from django.db import migrations, models


def merge_rows_per_item(apps, schema_editor):
    WarbandItem = apps.get_model("warbands", "WarbandItem")
    kept: dict[tuple[int, int], Any] = {}
    for row in WarbandItem.objects.order_by("-id"):
        key = (row.warband_id, row.item_id)
        if key not in kept:
            kept[key] = row
            continue
        newest = kept[key]
        newest.quantity += row.quantity
        newest.save(update_fields=["quantity"])
        row.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0006_item_generated_effect_key_and_source_item"),
        ("warbands", "0033_ledger_recent_indexes"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="warbanditem",
            name="unique_warband_item",
        ),
        migrations.RunPython(migrations.RunPython.noop, merge_rows_per_item),
        migrations.AddConstraint(
            model_name="warbanditem",
            constraint=models.UniqueConstraint(
                fields=("warband", "item", "cost"), name="unique_warband_item_cost", nulls_distinct=False
            ),
        ),
    ]
