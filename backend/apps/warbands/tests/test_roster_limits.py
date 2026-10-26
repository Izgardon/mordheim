"""Caps and warband size (decision 12, BUG-29, BUG-67, BUG-105).

The hero and hired-sword caps are the only hard blocks, and only on adding units directly: they count
living, non-dismissed units (hired swords also not blood-pacted), are checked inside the create's
transaction with the warband locked, and answer 400 with a stable `code`. Warband size (`max_units`) and a
group's `max_size` only warn: the summary reports what the client needs to say so.
"""

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import Henchman

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRELING,
    RosterTestCase,
    cap_error,
    create_payload,
    make_unit,
    unit_url,
)


class CapTests(RosterTestCase):
    def test_each_cap_is_checked_under_the_warband_lock_inside_the_create(self):
        # BUG-105: the count ran before the transaction, so two concurrent creates could both pass
        for kind, table in ((HERO, "hero"), (HIRELING, "hireling")):
            with self.subTest(kind=kind.key):
                with CaptureQueriesContext(connection) as captured:
                    response = self.client.post(unit_url(kind, self.warband.id), create_payload(kind), format="json")
                self.assertEqual(response.status_code, 201)
                sql = [query["sql"] for query in captured]
                begin = next(i for i, text in enumerate(sql) if text.startswith("SAVEPOINT"))
                lock = next(i for i, text in enumerate(sql) if 'FROM "warband"' in text and "FOR UPDATE" in text)
                count = next(i for i, text in enumerate(sql) if "COUNT(*)" in text and f'FROM "{table}"' in text)
                insert = next(i for i, text in enumerate(sql) if text.startswith(f'INSERT INTO "{table}"'))
                self.assertLess(begin, lock)
                self.assertLess(lock, count)
                self.assertLess(count, insert)

    def test_over_the_cap_nothing_is_written(self):
        self.campaign_settings.max_heroes = 1
        self.campaign_settings.save()
        make_unit(HERO, self.warband)
        trades_before = self.warband.trades.count()

        response = self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO), format="json")

        self.assertEqual((response.status_code, response.json()), (400, cap_error("Warband already has 1 heroes")))
        self.assertEqual((self.warband.heroes.count(), self.warband.trades.count()), (1, trades_before))

    def test_blood_pacted_hirelings_are_exempt_and_uncounted(self):
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        url = unit_url(HIRELING, self.warband.id)
        for _ in range(2):
            pacted = self.client.post(url, create_payload(HIRELING, blood_pacted=True), format="json")
            self.assertEqual(pacted.status_code, 201)
        self.assertEqual(self.client.post(url, create_payload(HIRELING), format="json").status_code, 201)
        refused = self.client.post(url, create_payload(HIRELING), format="json")
        self.assertEqual(refused.json()["code"], "hired_sword_cap_reached")

    def test_editing_existing_units_never_hits_a_cap(self):
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        make_unit(HIRELING, self.warband)
        pacted = make_unit(HIRELING, self.warband, blood_pacted=True)

        response = self.client.patch(
            unit_url(HIRELING, self.warband.id, pacted.id), {"blood_pacted": False}, format="json"
        )

        self.assertEqual(response.status_code, 200)  # two counted hired swords now: allowed, not added directly


class WarbandSizeTests(RosterTestCase):
    def _summary(self) -> dict:
        response = self.client.get(f"/api/warbands/{self.warband.id}/summary/")
        self.assertEqual(response.status_code, 200)
        body: dict = response.json()
        return body

    def test_the_summary_reports_size_and_cap_counts(self):
        make_unit(HERO, self.warband)
        make_unit(HERO, self.warband, dead=True)
        group = make_unit(HENCHMEN, self.warband, members=("A", "B", "C"))
        Henchman.objects.create(group=group, name="Fallen", dead=True)
        Henchman.objects.create(group=group, name="Gone", dismissed_at="2026-01-01T00:00:00Z")
        make_unit(HENCHMEN, self.warband, members=("X",), dismissed_at="2026-01-01T00:00:00Z")
        make_unit(HIRELING, self.warband)
        make_unit(HIRELING, self.warband, blood_pacted=True)
        make_unit(HIRELING, self.warband, blood_pacted=True, dead=True)
        self.campaign_settings.max_heroes = 4
        self.campaign_settings.save()

        summary = self._summary()

        counts = {key: summary[key] for key in ("unit_count", "max_units", "hero_count", "max_heroes")}
        counts |= {key: summary[key] for key in ("hireling_count", "max_hired_swords")}
        # size: 1 hero + 3 living henchmen + 1 blood-pacted hired sword; caps: 1 hero, 1 hired sword
        self.assertEqual(
            counts,
            {
                "unit_count": 5,
                "max_units": 15,
                "hero_count": 1,
                "max_heroes": 4,
                "hireling_count": 1,
                "max_hired_swords": 3,
            },
        )
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(sheet["summary"], summary)

    def test_size_and_group_limits_only_warn(self):
        self.warband.max_units = 2
        self.warband.save()
        payload = create_payload(HENCHMEN, max_size=2, henchmen=[{"name": n} for n in ("A", "B", "C")])

        response = self.client.post(unit_url(HENCHMEN, self.warband.id), payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["henchmen"]), 3)
        summary = self._summary()
        self.assertEqual((summary["unit_count"], summary["max_units"]), (3, 2))

    def test_new_warbands_default_to_fifteen_units(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/warbands/",
            {"name": "New", "faction": "Witch Hunters", "campaign_id": self.campaign.id},
            format="json",
        )
        self.assertEqual((response.status_code, response.json()["max_units"]), (201, 15))
