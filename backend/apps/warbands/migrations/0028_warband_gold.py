# The stored balance (decision 4, ECON-CQ-01): `Warband.gold`, the sum of the warband's ledger, kept by
# services/ledger.py. A constant default adds the column without rewriting the table (PostgreSQL 11+), and the
# database default stays, so a warband created by the previous release while this one deploys still inserts.
# 0029 fills it in.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("warbands", "0027_signed_ledger_prices"),
    ]

    operations = [
        migrations.AddField(
            model_name="warband",
            name="gold",
            field=models.BigIntegerField(db_default=0, default=0),
        ),
    ]
