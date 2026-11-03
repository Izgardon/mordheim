from collections import defaultdict

from django.db import migrations

DEFAULT_NAME = "Wyrdstone"
# A frozen copy of the Wyrdstone spellings fees pay from (apps/hirelings/fees.py RESOURCE_NAMES) on 3 Nov 2026.
WYRDSTONE_NAMES = ("wyrdstone", "wyrdstones", "wyrdstone shard", "wyrdstone shards", "shard", "shards")


def _key(name: str) -> str:
    return " ".join(name.lower().split())


def _pick(resources: list, name: str):
    """The resource that becomes the default: the one named as the setting names it (exactly, then in any case),
    else the oldest Wyrdstone-like one; None when there is none. Renaming the pick to `name` can't clash."""
    exact = [row for row in resources if row.name == name]
    alike = [row for row in resources if _key(row.name) == _key(name)]
    wyrdstone = [row for row in resources if _key(row.name) in WYRDSTONE_NAMES]
    return next(iter(exact or alike or wyrdstone), None)


def mark_default_resources(apps, schema_editor) -> None:
    """Each warband without a default resource gets one: its Wyrdstone-like resource (as fees spell it), renamed as
    its campaign's setting names it, else a new one of that name at 0. The other resources stay as they are."""
    warband_model = apps.get_model("warbands", "Warband")
    resource_model = apps.get_model("warbands", "WarbandResource")
    names = dict(warband_model.objects.values_list("id", "campaign__settings__default_resource_name"))
    has_default = set(resource_model.objects.filter(is_default=True).values_list("warband_id", flat=True))
    resources: dict[int, list] = defaultdict(list)
    for row in resource_model.objects.filter(is_default=False).order_by("id"):
        resources[row.warband_id].append(row)
    marked, created = [], []
    for warband_id, setting in names.items():
        if warband_id in has_default:
            continue
        name = setting or DEFAULT_NAME
        row = _pick(resources[warband_id], name)
        if row is None:
            created.append(resource_model(warband_id=warband_id, name=name, amount=0, is_default=True))
            continue
        row.name, row.is_default = name, True
        marked.append(row)
    resource_model.objects.bulk_update(marked, ["name", "is_default"])
    resource_model.objects.bulk_create(created)


class Migration(migrations.Migration):
    """Every existing warband gets its default resource (mark_default_resources)."""

    dependencies = [
        ("campaigns", "0010_campaign_settings_default_resource_name"),
        ("warbands", "0012_warband_resource_default"),
    ]

    operations = [
        migrations.RunPython(mark_default_resources, migrations.RunPython.noop),
    ]
