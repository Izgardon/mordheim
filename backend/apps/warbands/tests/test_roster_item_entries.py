"""BUG-104: a unit `items` entry without a usable id (or with a bad cost) is a 400 field error, not a 500."""

from typing import Any

from .roster_support import KINDS, RosterTestCase, create_payload, make_unit, related_ids, unit_url


class ItemEntryValidationTests(RosterTestCase):
    def _bad_entries(self) -> list[Any]:
        return [
            {},
            {"cost": 10},
            {"id": None},
            {"id": "abc"},
            {"id": True},
            {"id": [self.sword.id]},
            "Sword",
            {"id": self.sword.id, "cost": -1},
            {"id": self.sword.id, "cost": "ten"},
            {"id": self.sword.id, "cost": 2147483648},
        ]

    def test_bad_entries_are_a_400_on_items_and_write_nothing(self):
        for kind in KINDS:
            unit = make_unit(kind, self.warband, name="Kept")
            for entry in self._bad_entries():
                with self.subTest(kind=kind.key, entry=entry):
                    created = self.client.post(
                        unit_url(kind, self.warband.id), create_payload(kind, items=[entry]), format="json"
                    )
                    patched = self.client.patch(
                        unit_url(kind, self.warband.id, unit.id), {"name": "Changed", "items": [entry]}, format="json"
                    )
                    for response in (created, patched):
                        self.assertEqual(response.status_code, 400)
                        self.assertEqual(list(response.json()), ["items"])
            unit.refresh_from_db()
            self.assertEqual((unit.name, related_ids(unit, kind.items, "item")), ("Kept", []))
            self.assertEqual(kind.model.objects.filter(warband=self.warband).count(), 1)

    def test_good_entries_keep_working(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                items = [
                    {"id": str(self.sword.id)},  # a numeric string, no cost: the single availability's 10
                    {"id": self.axe.id, "cost": 7, "name": "Axe", "type": "Melee"},  # extra keys are ignored
                    {"id": self.axe.id, "cost": None},  # two availabilities: no default cost
                ]
                response = self.client.post(
                    unit_url(kind, self.warband.id), create_payload(kind, items=items), format="json"
                )
                self.assertEqual(response.status_code, 201, response.data)
                unit = kind.model.objects.get(id=response.json()["id"])
                rows = list(getattr(unit, kind.items).order_by("id").values_list("item_id", "cost"))
                self.assertEqual(rows, [(self.sword.id, 10), (self.axe.id, 7), (self.axe.id, None)])
