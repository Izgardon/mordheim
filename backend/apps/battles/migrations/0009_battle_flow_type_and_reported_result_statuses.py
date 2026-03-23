from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0008_remove_battle_winner_warband"),
    ]

    operations = [
        migrations.AddField(
            model_name="battle",
            name="flow_type",
            field=models.CharField(
                choices=[("normal", "Normal"), ("reported_result", "Reported result")],
                default="normal",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="battle",
            name="status",
            field=models.CharField(
                choices=[
                    ("inviting", "Inviting"),
                    ("reported_result_pending", "Reported result pending"),
                    ("prebattle", "Prebattle"),
                    ("active", "Active"),
                    ("postbattle", "Postbattle"),
                    ("ended", "Ended"),
                    ("canceled", "Canceled"),
                ],
                default="inviting",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="battleparticipant",
            name="status",
            field=models.CharField(
                choices=[
                    ("invited", "Invited"),
                    ("accepted", "Accepted"),
                    ("reported_result_pending", "Reported result pending"),
                    ("reported_result_approved", "Reported result approved"),
                    ("reported_result_declined", "Reported result declined"),
                    ("joined_prebattle", "Joined prebattle"),
                    ("ready", "Ready"),
                    ("canceled_prebattle", "Canceled prebattle"),
                    ("in_battle", "In battle"),
                    ("finished_battle", "Finished battle"),
                    ("confirmed_postbattle", "Confirmed postbattle"),
                ],
                default="invited",
                max_length=30,
            ),
        ),
    ]
