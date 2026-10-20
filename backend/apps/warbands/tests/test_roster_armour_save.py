"""Armour saves (decision 11, BUG-87): 5, "5" and "5+" all mean 5+, on every unit write path.

Saves better than 1+ are allowed down to -5+ (Strength modifiers can get there on paper); 6+ is the worst
save and empty means none. Anything else is a 400 on `armour_save`. Payloads answer the integer N.
"""

from typing import Any

from django.test import SimpleTestCase

from apps.battles.services.unit_information import parse_armour_save_override
from apps.warbands.utils.armour_save import ARMOUR_SAVE_ERROR, parse_armour_save

from .roster_support import KINDS, RosterTestCase, create_payload, make_unit, unit_url

ACCEPTED: list[tuple[Any, int | None]] = [
    (5, 5),
    ("5", 5),
    ("5+", 5),
    (" 4 + ", 4),
    (6, 6),
    ("1+", 1),
    ("0+", 0),
    ("-1+", -1),
    (-5, -5),
    (3.0, 3),
    ("", None),
    (None, None),
]
REJECTED: list[Any] = ["7+", 7, -6, "-6+", "abc", "5++", "+5", "5-", 5.5, True, [5], {"save": 5}, "nan"]


class ArmourSaveParsingTests(SimpleTestCase):
    def test_accepted_forms(self):
        for value, expected in ACCEPTED:
            with self.subTest(value=value):
                self.assertEqual(parse_armour_save(value), expected)

    def test_rejected_forms(self):
        for value in [*REJECTED, float("inf")]:
            with self.subTest(value=value):
                with self.assertRaisesMessage(ValueError, ARMOUR_SAVE_ERROR):
                    parse_armour_save(value)

    def test_postbattle_overrides_parse_the_same_way(self):
        self.assertEqual(
            [parse_armour_save_override(value) for value in ("-", "", None, "4+", "-1+")], [None, None, None, 4, -1]
        )
        with self.assertRaisesMessage(ValueError, "unit information armour_save"):
            parse_armour_save_override("9+")


class ArmourSaveWriteTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.campaign_settings.max_heroes = self.campaign_settings.max_hired_swords = 100
        self.campaign_settings.save()

    def test_create_and_patch_accept_every_form_and_answer_an_integer(self):
        for kind in KINDS:
            for value, expected in ACCEPTED:
                with self.subTest(kind=kind.key, value=value):
                    created = self.client.post(
                        unit_url(kind, self.warband.id), create_payload(kind, armour_save=value), format="json"
                    )
                    self.assertEqual((created.status_code, created.json()["armour_save"]), (201, expected))
                    unit = make_unit(kind, self.warband, armour_save=2)
                    patched = self.client.patch(
                        unit_url(kind, self.warband.id, unit.id), {"armour_save": value}, format="json"
                    )
                    self.assertEqual((patched.status_code, patched.json()["armour_save"]), (200, expected))
                    unit.refresh_from_db()
                    self.assertEqual(unit.armour_save, expected)

    def test_anything_else_is_a_field_error_and_writes_nothing(self):
        for kind in KINDS:
            unit = make_unit(kind, self.warband, armour_save=4)
            for value in REJECTED:
                with self.subTest(kind=kind.key, value=value):
                    created = self.client.post(
                        unit_url(kind, self.warband.id), create_payload(kind, armour_save=value), format="json"
                    )
                    patched = self.client.patch(
                        unit_url(kind, self.warband.id, unit.id), {"armour_save": value, "name": "X"}, format="json"
                    )
                    for response in (created, patched):
                        self.assertEqual(
                            (response.status_code, response.json()), (400, {"armour_save": [ARMOUR_SAVE_ERROR]})
                        )
            unit.refresh_from_db()
            self.assertEqual((unit.armour_save, unit.name), (4, "Test " + kind.key))
            self.assertEqual(kind.model.objects.filter(warband=self.warband).count(), 1)
            kind.model.objects.filter(id=unit.id).delete()
