"""Seeders that fail keep nothing, and say why (pass 5; BUG-17, BUG-54).

Each seeder runs in one transaction since PR A (only seed_bestiary did), and a missing or malformed stat stops
`seed_races` and `seed_bestiary` with an error naming the profile and the stat (seed_races crashed with a ValueError
on save; seed_bestiary wrote a 0).
"""

from typing import Any

from django.core.management.base import CommandError

from apps.bestiary.models import BestiaryEntry
from apps.items.models import Item
from apps.races.models import Race

from .catalogue_support import STATS
from .test_catalogue_characterisation_seeders import SeederTestCase, data_file, run, seed_items


class SeederFailureTests(SeederTestCase):
    def test_seed_items_failing_part_way_keeps_nothing(self):
        rows: list[dict[str, Any]] = [
            {"name": "Club", "type": "Weapon", "cost": 3},
            {"name": "Axe", "type": "Weapon", "properties": [999]},
        ]

        with self.assertRaisesMessage(CommandError, "Unknown property id 999 for item 'Axe'"):
            seed_items(rows)

        self.assertFalse(Item.objects.exists())

    def test_seed_races_failing_part_way_keeps_nothing(self):
        rows = [{"name": "Human", **STATS}, {"name": "Elf", **STATS, "movement": "fast"}]

        with data_file(rows) as path, self.assertRaisesMessage(CommandError, "Race 'Elf': movement is 'fast'."):
            run("seed_races", json_path=path)

        self.assertFalse(Race.objects.exists())

    def test_a_missing_stat_stops_seed_races_and_seed_bestiary_naming_it(self):
        partial = {key: value for key, value in STATS.items() if key not in ("strength", "leadership")}
        cases = [
            ("seed_races", {"json_path"}, [{"name": "Gnome", **partial}], "Race 'Gnome'"),
            ("seed_bestiary", {"json_paths"}, [{"name": "Boar", "kind": "mount", **partial}], "Bestiary entry 'Boar'"),
        ]
        for command, (option,), rows, label in cases:
            with self.subTest(command=command), data_file(rows) as path:
                value = [path] if option == "json_paths" else path
                with self.assertRaisesMessage(CommandError, f"{label}: strength is missing, leadership is missing."):
                    run(command, **{option: value})
        self.assertFalse(Race.objects.exists() or BestiaryEntry.objects.exists())
