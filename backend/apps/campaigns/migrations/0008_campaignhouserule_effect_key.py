from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0007_rename_campaign_pi_campaig_7e2813_idx_campaign_pi_campaig_e76bcb_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignhouserule",
            name="effect_key",
            field=models.CharField(blank=True, db_index=True, max_length=80, null=True),
        ),
    ]
