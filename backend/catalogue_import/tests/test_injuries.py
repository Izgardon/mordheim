"""The book's serious injury table (injuries.py): each result's D66 rolls, name and rule text from the snapshot."""

from django.test import SimpleTestCase

from catalogue_import.injuries import build_serious_injuries
from catalogue_import.snapshot import load_snapshot


def entry(name: str, rule: str, kind: str = "serious injury") -> dict:
    return {"type": kind, "name": name, "Rules": [{"rulename": "", "ruleFull": rule}]}


class SeriousInjuryTests(SimpleTestCase):
    def test_each_injury_has_its_rolls_its_name_and_its_rule_as_plain_text(self) -> None:
        fear = '<a href="/docs/rules/leadership-psychology#fear">fear</a>'
        entries = [
            entry("62-63 Hardened", f"<p>From now on he is immune to {fear}.</p>"),
            entry("64 Horrible Scars", "<p>He causes fear.<br /><br />From now on.</p>"),
            entry("Parry", "<p>Parried.</p>", kind="rules"),
        ]
        self.assertEqual(
            build_serious_injuries(entries),
            [  # a link keeps its words, its URL dropped (the review, 5 Nov 2026: L8)
                {"low": 62, "high": 63, "name": "Hardened", "text": "From now on he is immune to fear."},
                {"low": 64, "high": 64, "name": "Horrible Scars", "text": "He causes fear.\n\nFrom now on."},
            ],
        )

    def test_an_injury_without_its_roll_stops_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "no D66 roll in 'Hardened'"):
            build_serious_injuries([entry("Hardened", "<p>Immune to fear.</p>")])

    def test_the_snapshot_has_the_books_twenty_results_one_for_each_d66_roll(self) -> None:
        rows = build_serious_injuries(load_snapshot().injuries)
        codes = [tens * 10 + units for tens in range(1, 7) for units in range(1, 7)]
        self.assertEqual(len(rows), 20)
        self.assertEqual(sorted(code for row in rows for code in codes if row["low"] <= code <= row["high"]), codes)
        self.assertTrue(all(row["text"] for row in rows))
