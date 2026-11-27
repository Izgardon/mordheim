"""A book spell sits in its lore's setting as the catalogue import gives it (William, 27 Nov 2026: "always move skills,
lores, items down to the earliest adopter"): `out/setting-assignments.json`'s `lores`, else the setting the spell
names."""

import json
import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.spells.models import Spell

COMMAND = "apps.spells.management.commands.seed_spells_and_special"


class LoreSettingTests(TestCase):
    def test_a_spell_takes_its_lores_setting_from_the_import(self):
        early = CampaignType.objects.create(slug="mordheim-early", name="Early", grade="1a", sort_order=1)
        late = CampaignType.objects.create(slug="mordheim-late", name="Late", grade="2a", sort_order=2)
        spells = [
            {"name": "Moved Bolt", "type": "Moved Lore", "setting": late.slug, "dc": "7", "roll": 1},
            {"name": "Kept Bolt", "type": "Kept Lore", "setting": late.slug, "dc": "7", "roll": 1},
        ]
        assignments = {"lores": [{"name": "Moved Lore", "setting": early.slug, "how": "earliest adopter"}]}
        with tempfile.TemporaryDirectory() as folder:
            spells_path, assignments_path = Path(folder) / "spells.json", Path(folder) / "setting-assignments.json"
            spells_path.write_text(json.dumps(spells), encoding="utf-8")
            assignments_path.write_text(json.dumps(assignments), encoding="utf-8")
            with (
                mock.patch(f"{COMMAND}.SPELLS_JSON_PATH", spells_path),
                mock.patch(f"{COMMAND}.SETTING_ASSIGNMENTS_PATH", assignments_path),
            ):
                call_command("seed_spells_and_special", stdout=StringIO())
        settings = dict(Spell.objects.filter(campaign=None, type__in=["Moved Lore", "Kept Lore"]).values_list("type", "campaign_type_id"))  # fmt: skip
        self.assertEqual(settings, {"Moved Lore": early.id, "Kept Lore": late.id})
