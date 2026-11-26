"""One workshop per player, the database's rules (after 0027 named every workshop's player, in its own transaction)."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0027_workshop_per_player"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="campaign",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(
                        ("deleted_at__isnull", True),
                        ("kind", "campaign"),
                        ("workshop_owner__isnull", True),
                    ),
                    models.Q(
                        ("kind", "workshop"),
                        models.Q(
                            ("workshop_owner__isnull", False),
                            ("deleted_at__isnull", False),
                            _connector="OR",
                        ),
                    ),
                    _connector="OR",
                ),
                name="campaign_kind_fields",
            ),
        ),
        migrations.AddConstraint(
            model_name="campaign",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("workshop_owner",),
                name="one_workshop_per_player",
            ),
        ),
    ]
