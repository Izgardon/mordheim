"""The items rebuild: an item's flavour, source, link, tags, variant and notes; its rules (item_rule, item_rule_link)
in place of the properties; price rows with dice, a label, a cost note, Common as no rarity, for everyone and a note,
and who may buy each (item_availability_warband) in place of the restrictions. An existing item keeps its
description as its flavour and a rarity of 2 (how Common was stored) becomes Common; seed_items then rewrites the
book from the catalogue import."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bestiary", "0002_initial"),
        ("campaigns", "0008_merge_pivotal_moments_and_settings"),
        ("items", "0001_initial"),
        ("warbands", "0005_warband_drop_faction_restrictions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemAvailabilityWarband",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("excluded", models.BooleanField(default=False)),
            ],
            options={
                "db_table": "item_availability_warband",
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="ItemRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(blank=True, default="", max_length=120)),
                ("name", models.CharField(max_length=120)),
                ("summary", models.TextField(blank=True, default="", max_length=1000)),
                ("text", models.TextField(blank=True, default="", max_length=4000)),
            ],
            options={
                "db_table": "item_rule",
                "ordering": ["name", "id"],
            },
        ),
        migrations.CreateModel(
            name="ItemRuleLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveSmallIntegerField(default=0)),
                ("name", models.CharField(blank=True, default="", max_length=120)),
                ("summary", models.TextField(blank=True, default="", max_length=1000)),
                ("text", models.TextField(blank=True, default="", max_length=4000)),
                ("table", models.JSONField(blank=True, default=list)),
            ],
            options={
                "db_table": "item_rule_link",
                "ordering": ["position", "id"],
            },
        ),
        migrations.RemoveField(
            model_name="itemavailability",
            name="restrictions",
        ),
        # whole models, so the migration also runs backwards (a model's constraints name its fields)
        migrations.DeleteModel(
            name="ItemAvailabilityRestriction",
        ),
        migrations.DeleteModel(
            name="ItemPropertyLink",
        ),
        migrations.DeleteModel(
            name="ItemProperty",
        ),
        migrations.AlterModelOptions(
            name="itemavailability",
            options={"ordering": ["id"]},
        ),
        migrations.RemoveConstraint(
            model_name="item",
            name="item_unique_name_type",
        ),
        migrations.RemoveConstraint(
            model_name="itemavailability",
            name="item_availability_rarity_range",
        ),
        migrations.RemoveField(
            model_name="item",
            name="grade",
        ),
        migrations.RemoveField(
            model_name="itemavailability",
            name="variable_cost",
        ),
        migrations.AddField(
            model_name="item",
            name="flavour",
            field=models.TextField(blank=True, default="", max_length=4000),
        ),
        migrations.RunSQL("UPDATE item SET flavour = description", migrations.RunSQL.noop),
        migrations.RemoveField(
            model_name="item",
            name="description",
        ),
        migrations.AddField(
            model_name="item",
            name="link_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="item",
            name="notes",
            field=models.TextField(blank=True, default="", max_length=4000),
        ),
        migrations.AddField(
            model_name="item",
            name="source",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="item",
            name="tags",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="item",
            name="variant",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="cost_note",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="dice",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="dice_multiplier",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="for_everyone",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="label",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="itemavailability",
            name="note",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AlterField(
            model_name="item",
            name="range",
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AlterField(
            model_name="item",
            name="save_value",
            field=models.CharField(blank=True, db_column="save", max_length=80, null=True),
        ),
        migrations.AlterField(
            model_name="item",
            name="strength",
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AlterField(
            model_name="itemavailability",
            name="cost",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="itemavailability",
            name="rarity",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="item",
            constraint=models.UniqueConstraint(
                fields=("campaign", "name", "variant", "generated_effect_key"),
                name="item_unique_name_variant",
                nulls_distinct=False,
            ),
        ),
        migrations.RunSQL("UPDATE item_availability SET rarity = NULL WHERE rarity <= 2", migrations.RunSQL.noop),
        migrations.AddConstraint(
            model_name="itemavailability",
            constraint=models.CheckConstraint(
                check=models.Q(
                    ("rarity__isnull", True), models.Q(("rarity__gte", 2), ("rarity__lte", 20)), _connector="OR"
                ),
                name="item_availability_rarity_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemavailability",
            constraint=models.CheckConstraint(
                check=models.Q(("dice_multiplier__isnull", True), ("dice__isnull", False), _connector="OR"),
                name="item_availability_multiplier_has_dice",
            ),
        ),
        migrations.AddField(
            model_name="itemavailabilitywarband",
            name="availability",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="warband_links", to="items.itemavailability"
            ),
        ),
        migrations.AddField(
            model_name="itemavailabilitywarband",
            name="warband_group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="warbands.warbandgroup",
            ),
        ),
        migrations.AddField(
            model_name="itemavailabilitywarband",
            name="warband_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="+",
                to="warbands.warbandtype",
            ),
        ),
        migrations.AddField(
            model_name="itemrule",
            name="campaign",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="item_rules",
                to="campaigns.campaign",
            ),
        ),
        migrations.AddField(
            model_name="itemrulelink",
            name="item",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="rule_links", to="items.item"
            ),
        ),
        migrations.AddField(
            model_name="itemrulelink",
            name="rule",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="links",
                to="items.itemrule",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemavailabilitywarband",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("warband_group__isnull", True), ("warband_type__isnull", False)),
                    models.Q(("warband_group__isnull", False), ("warband_type__isnull", True)),
                    _connector="OR",
                ),
                name="item_availability_warband_type_or_group",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemrule",
            constraint=models.UniqueConstraint(
                condition=models.Q(("campaign__isnull", True), models.Q(("slug", ""), _negated=True)),
                fields=("slug",),
                name="item_rule_slug",
            ),
        ),
    ]
