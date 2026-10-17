"""SEC-07 (unit half): unit writes accept only global catalogue entries or the warband's own campaign's."""

from typing import Any

from apps.campaigns.models import Campaign
from apps.items.models import Item
from apps.races.models import Race
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

from .roster_support import HENCHMEN, KINDS, Kind, RosterTestCase, create_payload, make_unit, related_ids, unit_url


class CatalogueScopeTests(RosterTestCase):
    other_campaign: Campaign
    own: dict[str, Any]
    foreign: dict[str, Any]

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.other_campaign = Campaign.objects.get(name="Elsewhere")
        own, other = cls.campaign, cls.other_campaign
        cls.own = {
            "skill_ids": Skill.objects.create(name="House skill", type="Combat", campaign=own),
            "special_ids": Special.objects.create(name="House special", type="Ability", campaign=own),
            "spell_ids": Spell.objects.create(name="House spell", type="Magic", campaign=own),
            "items": Item.objects.create(name="House blade", type="Melee", campaign=own),
        }
        cls.foreign = {
            "skill_ids": Skill.objects.create(name="Their skill", type="Combat", campaign=other),
            "special_ids": Special.objects.create(name="Their special", type="Ability", campaign=other),
            "spell_ids": Spell.objects.create(name="Their spell", type="Magic", campaign=other),
            "items": Item.objects.create(name="Their blade", type="Melee", campaign=other),
        }

    def _fields(self, kind: Kind) -> list[str]:
        return [
            field for field in ("skill_ids", "special_ids", "spell_ids", "items") if field != "spell_ids" or kind.spells
        ]

    def _value(self, field: str, entry: Any) -> list[Any]:
        return [{"id": entry.id, "cost": 5}] if field == "items" else [entry.id]

    def test_another_campaigns_entries_are_a_400_on_create_and_nothing_is_created(self):
        for kind in KINDS:
            for field in self._fields(kind):
                with self.subTest(kind=kind.key, field=field):
                    payload = create_payload(kind, **{field: self._value(field, self.foreign[field])})
                    response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")
                    expected = {field: [f"Not available in this campaign: {self.foreign[field].id}."]}
                    self.assertEqual((response.status_code, response.json()), (400, expected))
                    self.assertFalse(kind.model.objects.filter(warband=self.warband).exists())

    def test_another_campaigns_entries_are_a_400_on_patch_and_nothing_changes(self):
        for kind in KINDS:
            for field in self._fields(kind):
                with self.subTest(kind=kind.key, field=field):
                    unit = make_unit(kind, self.warband, name="Original")
                    payload = {"name": "Renamed", field: self._value(field, self.foreign[field])}
                    response = self.client.patch(unit_url(kind, self.warband.id, unit.id), payload, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(list(response.json()), [field])
                    unit.refresh_from_db()
                    self.assertEqual(unit.name, "Original")

    def test_a_patch_with_another_campaigns_race_is_a_400(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                unit = make_unit(kind, self.warband, race=self.race)
                response = self.client.patch(
                    unit_url(kind, self.warband.id, unit.id), {"race": self.foreign_race.id}, format="json"
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.json()), ["race"])
                unit.refresh_from_db()
                self.assertEqual(unit.race_id, self.race.id)

    def test_global_and_own_campaign_entries_are_accepted(self):
        own_race = Race.objects.create(name="House race", campaign=self.campaign)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(kind, race=own_race.id)
                for field in self._fields(kind):
                    payload[field] = self._value(field, self.own[field])
                payload["skill_ids"].append(self.skills[0].id)  # a global skill
                response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")
                self.assertEqual(response.status_code, 201, response.json())
                unit = kind.model.objects.get(id=response.json()["id"])
                self.assertEqual(unit.race_id, own_race.id)
                self.assertEqual(related_ids(unit, kind.skills, "skill"), [self.own["skill_ids"].id, self.skills[0].id])
                self.assertEqual(related_ids(unit, kind.items, "item"), [self.own["items"].id])

    def test_unknown_ids_are_still_dropped_silently(self):
        unit = make_unit(HENCHMEN, self.warband)
        response = self.client.patch(
            unit_url(HENCHMEN, self.warband.id, unit.id), {"skill_ids": [999999, self.skills[0].id]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(related_ids(unit, HENCHMEN.skills, "skill"), [self.skills[0].id])
