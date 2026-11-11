"""Which template a warband uses (the campaign's own for its type, else the book's, else none; never through the types
it counts as), its variant applied, and whether list prices are open (until the fight of its first battle is over)."""

from django.db import transaction
from django.utils import timezone

from apps.battles.models import Battle, BattleParticipant
from apps.core.catalogue import versions
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.models import CatalogueRemoval
from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warband_templates.models import TemplateRule, WarbandTemplate, WarbandTemplateType
from apps.warband_templates.services.list_prices import list_prices_open
from apps.warband_templates.services.resolve import (
    apply_variant,
    in_variant,
    template_for_type,
    template_gold,
    template_size,
    variant_rules,
)
from apps.warbands.models import WarbandType

from .support import Made, make_template


class TemplateForTypeTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)

    def found(self) -> WarbandTemplate | None:
        return template_for_type(self.campaign.id, self.mercenaries.id)

    def test_the_book_template_serves_its_type_with_the_types_preset_variant(self) -> None:
        found = self.found()
        assert found is not None
        self.assertEqual((found.pk, getattr(found, "preset_variant")), (self.made.template.pk, "reikland"))  # noqa: B009

    def test_the_campaigns_house_version_stands_in_for_the_books(self) -> None:
        with transaction.atomic():
            version = versions.editable(WARBAND_TEMPLATES, self.made.template, self.campaign.id)
        found = self.found()
        assert found is not None
        self.assertEqual(found.pk, version.pk)
        self.assertEqual(template_for_type(self.elsewhere.id, self.mercenaries.id), self.made.template)

    def test_a_template_made_in_the_campaign_for_a_book_type_comes_first(self) -> None:
        own = WarbandTemplate.objects.create(name="Our Mercenaries", campaign=self.campaign)
        WarbandTemplateType.objects.create(template=own, campaign=self.campaign, warband_type=self.mercenaries)
        self.assertEqual(self.found(), own)

    def test_a_removed_or_archived_template_serves_nobody(self) -> None:
        CatalogueRemoval.objects.create(
            campaign=self.campaign, kind="warband_templates", entry_id=self.made.template.pk
        )
        self.assertIsNone(self.found())
        CatalogueRemoval.objects.all().delete()
        WarbandTemplate.objects.filter(pk=self.made.template.pk).update(archived_at=timezone.now())
        self.assertIsNone(self.found())

    def test_a_type_without_a_template_and_the_types_it_counts_as_find_none(self) -> None:
        lizardmen = WarbandType.objects.create(name="Lizardmen", slug="lizardmen")
        self.assertIsNone(template_for_type(self.campaign.id, lizardmen.id))
        self.warband.warband_type = lizardmen
        self.warband.save()
        self.warband.counts_as.set([self.mercenaries])
        self.assertIsNone(template_for_type(self.campaign.id, self.warband.warband_type_id))
        self.assertIsNone(template_for_type(self.campaign.id, None))

    def test_a_variant_and_a_type_pick_their_rules_and_a_variant_changes_its_fighters(self) -> None:
        ostermarkers = WarbandType.objects.create(name="Ostermarkers", slug="ostermarkers")
        TemplateRule.objects.create(template=self.made.template, position=2, title="Wardogs", warband_type=ostermarkers)
        rules = list(self.made.template.rules.all())
        type_id = self.mercenaries.id
        self.assertEqual([rule.title for rule in variant_rules(rules, "", type_id)], ["Hard Bargains"])
        self.assertEqual(
            [rule.title for rule in variant_rules(rules, "reikland", type_id)], ["Hard Bargains", "Marksmen"]
        )
        self.assertEqual(
            [rule.title for rule in variant_rules(rules, "", ostermarkers.id)], ["Hard Bargains", "Wardogs"]
        )
        captain = self.made.captain
        captain.skill_types = ["Combat", "Shooting"]
        captain.variant_changes = {"middenheim": {"skill_types": ["Combat", "Strength"], "name": "Not changed"}}
        self.assertEqual(apply_variant(captain, "reikland").skill_types, ["Combat", "Shooting"])
        changed = apply_variant(captain, "middenheim")
        self.assertEqual((changed.skill_types, changed.name), (["Combat", "Strength"], "Captain"))

    def test_a_fighter_the_variant_allows_none_of_is_not_offered_in_it(self) -> None:
        # William, 11 Nov 2026: the Sartosa Orc Pirates and Savage Orcs are variants of the Orc Mob, so a variant
        # holds fighters the others do not (a Goblin Swabbie is no part of a Mordheim Orc Mob)
        swabbie = self.made.warriors
        swabbie.variant_changes = {"reikland": {"max_count": 0}}
        swabbie.save(update_fields=["variant_changes"])
        kept = in_variant(self.made.template.fighters.all(), "reikland")
        self.assertEqual([fighter.name for fighter in kept], ["Captain"])
        both = in_variant(self.made.template.fighters.all(), "middenheim")
        self.assertEqual(sorted(fighter.name for fighter in both), ["Captain", "Warrior"])

    def test_a_variant_changes_numbers_as_written_and_gives_its_own_gold_and_size(self) -> None:
        captain = self.made.captain
        captain.written_stats = {"attacks": "(2)", "movement": "D6"}
        captain.variant_changes = {
            "middenheim": {"stats": {"strength": 4, "attacks": "2(2)", "movement": 5}, "max_count": None}
        }
        changed = apply_variant(captain, "middenheim")
        self.assertEqual((changed.strength, changed.attacks, changed.movement, changed.max_count), (4, 2, 5, None))
        self.assertEqual(changed.written_stats, {"attacks": "(2)"})
        template = self.made.template
        template.variants = [
            {"key": "reikland", "name": "Reikland"},
            {"key": "hung", "starting_gold": 600, "max_models": 12},
        ]
        self.assertEqual((template_gold(template, "hung"), template_size(template, "hung")), (600, 12))
        self.assertEqual((template_gold(template, "reikland"), template_size(template, "")), (500, 15))


class ListPricesTests(CatalogueTestCase):
    def fought(self, battle_status: str, **fields: object) -> Battle:
        battle = self.open_battle(status=battle_status)
        if fields:
            BattleParticipant.objects.filter(battle=battle, warband=self.warband).update(**fields)
        return battle

    def test_open_until_a_battle_of_its_reaches_the_post_game_or_ends(self) -> None:
        self.assertTrue(list_prices_open(self.warband.id))
        for status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE, Battle.STATUS_CANCELED):
            self.fought(status)
        self.assertTrue(list_prices_open(self.warband.id))
        self.fought(Battle.STATUS_POSTBATTLE)
        self.assertFalse(list_prices_open(self.warband.id))
        self.assertTrue(list_prices_open(self.warband.id + 1000))

    def test_an_ended_battle_or_an_approved_reported_result_closes_them(self) -> None:
        battle = self.fought(Battle.STATUS_ENDED)
        battle.flow_type = Battle.FLOW_TYPE_REPORTED_RESULT
        battle.save()
        self.assertFalse(list_prices_open(self.warband.id))
        self.assertFalse(list_prices_open(self.rival_warband.id))

    def test_a_battle_it_left_or_was_taken_off_does_not_count(self) -> None:
        self.fought(Battle.STATUS_ENDED, status=BattleParticipant.STATUS_DECLINED)
        self.fought(Battle.STATUS_ENDED, removed_from_record=True)
        self.fought(Battle.STATUS_REPORTED_RESULT_PENDING)
        self.assertTrue(list_prices_open(self.warband.id))
        self.assertFalse(list_prices_open(self.rival_warband.id))
