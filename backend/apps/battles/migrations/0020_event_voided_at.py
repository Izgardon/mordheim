from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("battles", "0019_participant_declined"),
    ]

    operations = [
        migrations.AddField(
            model_name="battleevent",
            name="voided_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
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
                    ("unit_kill_voided", "Unit kill voided"),
                    ("item_used_voided", "Item use voided"),
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
    ]
