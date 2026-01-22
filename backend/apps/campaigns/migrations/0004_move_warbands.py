from django.db import migrations


def move_warbands(apps, schema_editor):
    try:
        CampaignWarband = apps.get_model("campaigns", "Warband")
    except LookupError:
        return
    Warband = apps.get_model("warbands", "Warband")
    db_alias = schema_editor.connection.alias

    records = list(CampaignWarband.objects.using(db_alias).all())
    if not records:
        return

    Warband.objects.using(db_alias).bulk_create(
        [
            Warband(
                id=record.id,
                campaign_id=record.campaign_id,
                user_id=record.user_id,
                name=record.name,
                faction=record.faction,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )
            for record in records
        ]
    )

    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(
            "SELECT setval(pg_get_serial_sequence('warbands_warband','id'), "
            "(SELECT COALESCE(MAX(id), 1) FROM warbands_warband));"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0003_warbands"),
        ("warbands", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(move_warbands, migrations.RunPython.noop),
    ]
