from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Campaign",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("campaign_type", models.CharField(max_length=80)),
                ("join_code", models.CharField(max_length=6, unique=True)),
                ("max_players", models.PositiveSmallIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="CampaignMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[("owner", "Owner"), ("admin", "Admin"), ("player", "Player")],
                        default="player",
                        max_length=10,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "campaign",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="campaigns.campaign"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="campaign_memberships", to=settings.AUTH_USER_MODEL),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="campaignmembership",
            constraint=models.UniqueConstraint(fields=("campaign", "user"), name="unique_campaign_membership"),
        ),
    ]
