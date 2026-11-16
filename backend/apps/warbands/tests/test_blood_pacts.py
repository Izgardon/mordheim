"""Blood pacts on a hired sword (Mutiny in Marienburg; a campaign setting since William called the rule generic).

The server owns the rule (units/services/blood_pacts.py) and every hired sword's payload carries it: `can_blood_pact`
(a living hired sword without a pact; a dramatis persona never swears one) and `blood_pact_bonus`, the +1 per skill or
characteristic increase he has gained that the post-game's 2D6 adds. Both read his own row, so neither costs a query.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.warbands.models import Hireling
from apps.warbands.units.services.blood_pacts import PACT_ROLL, can_pact, pact_bonus

from .roster_support import HIRELING, RosterTestCase, make_unit, unit_url


def history(*codes: str) -> list[dict[str, str]]:
    return [{"code": code, "label": code, "timestamp": "2026-11-16T00:00:00+00:00"} for code in codes]


class BloodPactRuleTests(RosterTestCase):
    def test_the_pact_is_sworn_on_a_12(self):
        self.assertEqual(PACT_ROLL, 12)

    def test_the_bonus_counts_skill_and_characteristic_increases_only(self):
        unit = make_unit(HIRELING, self.warband, level_up_history=history("WS", "Skill", "Ld", "Spell", "Special"))

        self.assertEqual(pact_bonus(unit), 3)

    def test_a_hired_sword_without_advances_adds_nothing(self):
        self.assertEqual(pact_bonus(make_unit(HIRELING, self.warband)), 0)

    def test_only_a_living_hired_sword_without_a_pact_can_swear_one(self):
        cases: dict[str, tuple[dict[str, Any], bool]] = {
            "plain": ({}, True),
            "pacted": ({"blood_pacted": True}, False),
            "dead": ({"dead": True}, False),
            "dismissed": ({"dismissed_at": timezone.now()}, False),
            "persona": ({"kind": "dramatis_persona"}, False),
        }
        for name, (fields, expected) in cases.items():
            with self.subTest(case=name):
                unit = Hireling.objects.create(warband=self.warband, name=name, **fields)
                self.assertEqual(can_pact(unit), expected)


class BloodPactPayloadTests(RosterTestCase):
    def rows(self) -> list[dict[str, Any]]:
        response = self.client.get(unit_url(HIRELING, self.warband.id))
        self.assertEqual(response.status_code, 200)
        rows: list[dict[str, Any]] = response.json()
        return rows

    def test_the_list_and_the_detail_carry_the_pact_fields(self):
        unit = make_unit(HIRELING, self.warband, level_up_history=history("WS", "Skill"))

        row = self.rows()[0]
        detail = self.client.get(unit_url(HIRELING, self.warband.id, unit.id)).json()

        self.assertEqual((row["blood_pact_bonus"], row["can_blood_pact"]), (2, True))
        self.assertEqual((detail["blood_pact_bonus"], detail["can_blood_pact"]), (2, True))

    def test_a_pact_sworn_hired_sword_says_he_can_swear_no_more(self):
        make_unit(HIRELING, self.warband, blood_pacted=True)

        self.assertEqual(self.rows()[0]["can_blood_pact"], False)

    def test_the_pact_fields_do_not_grow_the_list_budget_with_hired_swords(self):
        url = unit_url(HIRELING, self.warband.id)
        make_unit(HIRELING, self.warband, level_up_history=history("Skill"))
        self.client.get(url)  # the request's own reads (permissions, the catalogue scope) warmed up

        with CaptureQueriesContext(connection) as one:
            self.assertEqual(len(self.client.get(url).json()), 1)
        for _ in range(4):
            make_unit(HIRELING, self.warband, level_up_history=history("WS", "Skill"))
        with self.assertNumQueries(len(one.captured_queries)):
            self.assertEqual(len(self.client.get(url).json()), 5)
