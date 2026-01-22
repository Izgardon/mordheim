from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("campaigns", "0005_merge_0004_move_warbands_0004_table_names"),
    ]

    operations = [
        migrations.CreateModel(
            name="CampaignHouseRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "campaign",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="house_rules", to="campaigns.campaign"),
                ),
            ],
            options={
                "db_table": "campaign_house_rule",
                "ordering": ["created_at"],
            },
        ),
    ]
