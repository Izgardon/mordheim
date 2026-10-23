import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAccount",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="account",
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("session_key", models.UUIDField(default=uuid.uuid4)),
            ],
            options={
                "db_table": "user_account",
            },
        ),
    ]
