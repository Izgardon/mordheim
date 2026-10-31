"""A warband's type and the types it counts as (grading phase 1), with its free-text faction mapped onto them.

Production is wiped before the switch, but a dev database must still migrate cleanly. Where warbands exist, the
settings and the book's warband types are loaded from the catalogue import's files (a frozen copy of what
`seed_settings` and `seed_warband_types` write, keyed by slug, so seeding afterwards updates the same rows), and
each warband's faction is matched to a book type by name, case and spacing aside (a name the book uses twice takes
the type in the lowest setting). A faction that matches none becomes a custom type in its campaign, one per name.
Without the files every faction becomes a custom type. Each campaign is given the settings a new one starts with (the
Up to 1c preset, apps/campaigns/in_play.py), so it keeps what it had in play. An empty database does nothing here.
"""

import json
import re
from pathlib import Path

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils.text import slugify

IMPORT_OUT = Path(settings.BASE_DIR) / "catalogue_import" / "out"
UP_TO_1C = ("1a", "1b", "1c")  # a new campaign's preset (in_play.DEFAULT_PRESET), frozen here


def _key(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _read(name):
    try:
        return json.loads((IMPORT_OUT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _load_book(apps):
    """The book's types by name key (the import's files upserted by slug); empty without the files."""
    CampaignType = apps.get_model("campaigns", "CampaignType")
    WarbandType = apps.get_model("warbands", "WarbandType")
    setting_rows, type_rows = _read("settings.json"), _read("warband-types.json")
    if not setting_rows or not type_rows:
        return {}
    settings_by_slug = {}
    for row in setting_rows:
        fields = {key: row[key] for key in ("name", "grade", "sort_order", "always_on")}
        settings_by_slug[row["slug"]], _ = CampaignType.objects.update_or_create(slug=row["slug"], defaults=fields)
    book: dict = {}
    for row in type_rows:
        setting = settings_by_slug.get(row.get("setting"))
        fields = {
            "name": row["name"],
            "campaign_type": setting,
            **{key: row.get(key) or "" for key in ("race", "source", "source_code", "link_url")},
            "broheim_grade": row.get("broheim_grade") or "",
            "mordheimer_grade": row.get("mordheimer_grade") or "",
        }
        found, _ = WarbandType.objects.update_or_create(campaign=None, slug=row["slug"], defaults=fields)
        order = setting.sort_order if setting else 999
        if _key(row["name"]) not in book or order < book[_key(row["name"])][0]:
            book[_key(row["name"])] = (order, found)
    return {key: found for key, (_order, found) in book.items()}


def _custom(apps, campaign_id, name, made):
    """The campaign's own type for an unmatched faction, made once per name."""
    WarbandType = apps.get_model("warbands", "WarbandType")
    key = (campaign_id, name.strip().lower())
    if key not in made:
        base = slugify(name)[:120] or "custom"
        slug, count = base, 1
        while WarbandType.objects.filter(campaign_id=campaign_id, slug=slug).exists():
            count += 1
            slug = f"{base}-{count}"
        made[key] = WarbandType.objects.create(campaign_id=campaign_id, name=name.strip()[:120], slug=slug)
    return made[key]


def _tick_default_settings(apps):
    """Every campaign that ticks no setting gets the Up to 1c preset, as a new campaign does."""
    Campaign = apps.get_model("campaigns", "Campaign")
    CampaignType = apps.get_model("campaigns", "CampaignType")
    Link = apps.get_model("campaigns", "CampaignCampaignType")
    preset = list(CampaignType.objects.filter(grade__in=UP_TO_1C).values_list("id", flat=True))
    bare = Campaign.objects.filter(campaign_type_links__isnull=True).values_list("id", flat=True)
    Link.objects.bulk_create(
        [Link(campaign_id=campaign_id, campaign_type_id=setting_id) for campaign_id in bare for setting_id in preset]
    )


def map_factions(apps, schema_editor):
    Campaign = apps.get_model("campaigns", "Campaign")
    Warband = apps.get_model("warbands", "Warband")
    if not Campaign.objects.exists():
        return
    book = _load_book(apps)
    _tick_default_settings(apps)
    made: dict = {}
    for warband in Warband.objects.order_by("id"):
        faction = (warband.faction or "").strip() or "Unknown"
        warband.warband_type = book.get(_key(faction)) or _custom(apps, warband.campaign_id, faction, made)
        warband.save(update_fields=["warband_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0006_setting_grade_order_always_on"),
        ("warbands", "0003_warband_type_and_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="warband_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="warbands",
                to="warbands.warbandtype",
            ),
        ),
        migrations.AddField(
            model_name="warband",
            name="counts_as",
            field=models.ManyToManyField(
                blank=True, db_table="warband_counts_as", related_name="counted_by", to="warbands.warbandtype"
            ),
        ),
        migrations.RunPython(map_factions, migrations.RunPython.noop),
    ]
