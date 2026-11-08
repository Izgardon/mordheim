"""Unit notes (William, 8 Nov 2026: "can we also add notes to units, have them displayed in detailed card view"): the
player's free text on every roster unit (heroes, henchmen groups, hired swords and dramatis personae), up to 2000
characters, written through the unit's update (PATCH, or an update entry of the roster's batch Save, which the Edit
form sends) and read with the unit's detail payload, which the warband sheet carries."""

from typing import Any

from apps.warbands.models import Hireling

from .roster_support import HENCHMEN, HERO, HIRELING, KINDS, Kind, RosterTestCase, create_payload, make_unit, unit_url

NOTES = "Carries the warband's banner.\nOwes Grukk 5 gc."


class UnitNotesTests(RosterTestCase):
    def _patch(self, kind: Kind, unit: Any, body: dict[str, Any]) -> Any:
        return self.client.patch(unit_url(kind, self.warband.id, unit.id), body, format="json")

    def _batch(self, kind: Kind, body: dict[str, Any]) -> Any:
        return self.client.post(unit_url(kind, self.warband.id, suffix="batch/"), body, format="json")

    def test_a_new_unit_has_none(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                response = self._batch(kind, {"create": [create_payload(kind, name=f"New {kind.key}")]})

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.json()["units"][-1]["notes"], "")

    def test_the_edit_forms_save_writes_them_for_every_kind(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband)
                entry = {"id": unit.id, "updated_at": unit.updated_at.isoformat(), "notes": NOTES}

                response = self._batch(kind, {"update": [entry]})

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.json()["units"][0]["notes"], NOTES)
                unit.refresh_from_db()
                self.assertEqual(unit.notes, NOTES)

    def test_a_patch_writes_and_clears_them(self):
        persona = Hireling.objects.create(warband=self.warband, name="Bertha", kind="dramatis_persona")
        units = [(kind, make_unit(kind, self.warband)) for kind in KINDS] + [(HIRELING, persona)]
        for kind, unit in units:
            with self.subTest(kind=kind.key, name=unit.name):
                written = self._patch(kind, unit, {"notes": NOTES})
                cleared = self._patch(kind, unit, {"notes": ""})

                self.assertEqual((written.status_code, written.json()["notes"]), (200, NOTES))
                self.assertEqual((cleared.status_code, cleared.json()["notes"]), (200, ""))

    def test_they_are_capped_at_2000_characters(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, notes="Kept")

                at_cap = self._patch(kind, unit, {"notes": "x" * 2000})
                over = self._patch(kind, unit, {"notes": "x" * 2001})

                self.assertEqual(at_cap.status_code, 200, at_cap.data)
                self.assertEqual(over.status_code, 400)
                self.assertEqual(list(over.json()), ["notes"])
                unit.refresh_from_db()
                self.assertEqual(len(unit.notes), 2000)

    def test_the_sheet_carries_each_units_notes(self):
        make_unit(HERO, self.warband, notes="Hero notes")
        make_unit(HENCHMEN, self.warband, notes="Group notes")
        make_unit(HIRELING, self.warband, notes="Sword notes")

        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()

        self.assertEqual(
            [sheet[key][0]["notes"] for key in ("heroes", "henchmen_groups", "hirelings")],
            ["Hero notes", "Group notes", "Sword notes"],
        )
