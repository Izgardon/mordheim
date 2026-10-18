from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0018_battle_activity_and_deadline"),
    ]

    operations = [
        migrations.AlterField(
            model_name="battleevent",
            name="type",
            field=models.CharField(
                choices=[
                    ("battle_created", "Battle created"),
                    ("participant_invited", "Participant invited"),
                    ("participant_accepted", "Participant accepted"),
                    ("participant_joined_prebattle", "Participant joined prebattle"),
                    ("participant_ready_set", "Participant ready set"),
                    ("participant_ready_unset", "Participant ready unset"),
                    ("participant_canceled_prebattle", "Participant canceled prebattle"),
                    ("participant_declined", "Participant declined"),
                    ("participant_rejoined", "Participant rejoined"),
                    ("battle_started", "Battle started"),
                    ("battle_prebattle_opened", "Battle prebattle opened"),
                    ("participant_joined_battle", "Participant joined battle"),
                    ("kill_recorded", "Kill recorded"),
                    ("death_recorded", "Death recorded"),
                    ("item_used", "Item used"),
                    ("unit_ooa_set", "Unit out of action set"),
                    ("unit_ooa_unset", "Unit out of action unset"),
                    ("unit_kill_recorded", "Unit kill recorded"),
                    ("participant_finished_battle", "Participant finished battle"),
                    ("battle_entered_postbattle", "Battle entered postbattle"),
                    ("winner_declared", "Winner declared"),
                    ("participant_confirmed_postbattle", "Participant confirmed postbattle"),
                    ("battle_ended", "Battle ended"),
                    ("battle_canceled", "Battle canceled"),
                ],
                max_length=64,
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
                    ("declined", "Declined"),
                    ("in_battle", "In battle"),
                    ("finished_battle", "Finished battle"),
                    ("confirmed_postbattle", "Confirmed postbattle"),
                ],
                default="invited",
                max_length=30,
            ),
        ),
    ]
