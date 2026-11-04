"""seed_warband_templates on a small out/warband-templates.json: a template upserted by slug with its child rows written
afresh, its fighters' own rules as warband specials and ours reused, its written stats as units hold them, a dropped
template and a rule no template holds archived, and a name the book lacks stopping the run."""

import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.items.models import Item
from apps.races.models import Race
from apps.special.kinds import WARBAND
from apps.special.models import Special
from apps.warband_templates.models import TemplateFighter, TemplateListItem, WarbandTemplate
from apps.warbands.models import WarbandType

PROFILE = {
    "movement": 4,
    "weapon_skill": 4,
    "ballistic_skill": 3,
    "strength": 3,
    "toughness": 3,
    "wounds": 1,
    "initiative": 3,
    "attacks": "1(2)",
    "leadership": 12,
}


def fighter(**fields: Any) -> dict[str, Any]:
    return {
        "key": "captain",
        "kind": "hero",
        "name": "Captain",
        "plural": "Captains",
        "race": "Human",
        "cost": 60,
        "starting_xp": 20,
        "min_count": 1,
        "max_count": 1,
        "group_min": None,
        "group_max": None,
        "stats": PROFILE,
        "skill_types": ["Combat", "Academic"],
        "spell_types": [{"name": "Lesser Magic", "note": ""}],
        "gains_xp": True,
        "promotable": True,
        "is_leader": True,
        "caster": "Wizard",
        "large": False,
        "variant_changes": {"middenheim": {"skill_types": ["Combat"]}},
        "fixed_kit": "",
        "lists": ["kit"],
        "specials": [
            {"name": "Leader", "type": "Warband - Mercenaries", "description": "Leads."},
            {"name": "Large", "type": "Trait"},
        ],
        **fields,
    }


def template(**fields: Any) -> dict[str, Any]:
    line = {
        "item": {"name": "Dagger", "variant": ""},
        "shown_as": "Jambiya",
        "cost": 2,
        "cost_note": "",
        "first_free": True,
        "brace_cost": None,
        "who": {"heroes": True},
        "warband_max": None,
        "note": "",
    }
    return {
        "slug": "mercenaries",
        "name": "Mercenaries",
        "setting": "mordheim",
        "source": "Mordheim Rulebook",
        "link_url": "",
        "starting_gold": 500,
        "max_models": 15,
        "variants": [{"key": "reikland", "name": "Reikland"}],
        "types": [{"type": "reiklanders", "variant": "reikland"}],
        "rules": [{"title": "Hard Bargains", "description": "Haggle.", "variant": ""}],
        "lists": [{"key": "kit", "name": "Kit", "note": "", "lines": [line]}],
        "fighters": [fighter()],
        "upgrades": [
            {
                "group": "Mutations",
                "special": {"name": "Tentacle", "type": "Warband - Mercenaries", "description": "Grabs."},
                "cost": 35,
                "cost_note": "",
                "note": "",
            }
        ],
        **fields,
    }


def seed(*templates: dict[str, Any]) -> str:
    output = StringIO()
    with TemporaryDirectory() as folder:
        Path(folder, "warband-templates.json").write_text(json.dumps(list(templates)), encoding="utf-8")
        call_command("seed_warband_templates", out=folder, stdout=output)
    return output.getvalue()


class SeedWarbandTemplatesTests(TestCase):
    mordheim: CampaignType
    reiklanders: WarbandType
    human: Race
    dagger: Item
    large: Special

    @classmethod
    def setUpTestData(cls) -> None:
        cls.mordheim = mordheim = CampaignType.objects.create(
            slug="mordheim", name="Mordheim", grade="1a", always_on=True
        )
        cls.reiklanders = WarbandType.objects.create(name="Reiklanders", slug="reiklanders", campaign_type=mordheim)
        cls.human = Race.objects.create(name="Human", **{key: 4 for key in PROFILE})
        cls.dagger = Item.objects.create(name="Dagger", type="Weapon", campaign_type=mordheim)
        cls.large = Special.objects.create(name="Large", type="Trait")

    def test_a_template_is_written_with_its_types_rules_lists_fighters_and_upgrades(self) -> None:
        output = seed(template())

        self.assertIn("Templates: 1, archived (no longer in the import): 0", output)
        made = WarbandTemplate.objects.get(slug="mercenaries", campaign__isnull=True)
        self.assertEqual((made.name, made.starting_gold, made.campaign_type_id), ("Mercenaries", 500, self.mordheim.id))
        self.assertEqual(
            list(made.type_links.values_list("warband_type_id", "variant")), [(self.reiklanders.id, "reikland")]
        )
        self.assertEqual(list(made.rules.values_list("title", "variant")), [("Hard Bargains", "")])
        line = TemplateListItem.objects.get(equipment_list__template=made)
        self.assertEqual(
            (line.item_id, line.shown_as, line.first_free, line.who),
            (self.dagger.id, "Jambiya", True, {"heroes": True}),
        )
        captain = made.fighters.get()
        self.assertEqual((captain.race_id, captain.attacks, captain.leadership), (self.human.id, 1, None))
        self.assertEqual(captain.written_stats, {"attacks": "(2)", "leadership": "12"})
        self.assertEqual([link.equipment_list.key for link in captain.list_links.all()], ["kit"])
        rules = {link.special.name: link.special for link in captain.special_links.select_related("special")}
        self.assertEqual(rules["Large"].id, self.large.id)
        self.assertEqual((rules["Leader"].owner_kind, rules["Leader"].description), (WARBAND, "Leads."))
        self.assertEqual(made.upgrades.get().special.name, "Tentacle")

    def test_a_reseed_writes_the_child_rows_afresh_and_archives_what_went(self) -> None:
        seed(template(), template(slug="skaven", name="Skaven", types=[], lists=[], fighters=[], upgrades=[]))
        first = TemplateFighter.objects.get().pk

        output = seed(template(fighters=[fighter(specials=[{"name": "Large", "type": "Trait"}])], upgrades=[]))

        self.assertIn("archived (no longer in the import): 1; their own specials archived: 2", output)
        self.assertNotEqual(TemplateFighter.objects.get().pk, first)
        self.assertIsNotNone(WarbandTemplate.objects.get(slug="skaven").archived_at)
        gone = Special.objects.filter(owner_kind=WARBAND, archived_at__isnull=False).values_list("name", flat=True)
        self.assertEqual(set(gone), {"Leader", "Tentacle"})

    def test_a_name_the_book_lacks_stops_the_run_and_keeps_nothing(self) -> None:
        missing = template(lists=[{"key": "kit", "name": "Kit", "note": "", "lines": [{**template()["lists"][0]["lines"][0], "item": {"name": "Halberd", "variant": ""}}]}])  # fmt: skip
        with self.assertRaisesRegex(CommandError, "Mercenaries, Kit: item \\('Halberd', ''\\) isn't seeded"):
            seed(missing)
        self.assertFalse(WarbandTemplate.objects.exists())
