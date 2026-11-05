"""The template editor and the shared specials (William, 5 Nov 2026; special/shared.py): a fighter rule or upgrade
that is a shared general special (Fear, a mutation) is linked by each save, on the book template's house version too,
and never copied, renamed or reworded; a rule the editor writes in a group of mutations is still a mutation."""

from apps.special.categories import MUTATION
from apps.special.kinds import GENERAL
from apps.special.models import Special
from apps.warband_templates.models import TemplateFighterSpecial, TemplateUpgrade, WarbandTemplate

from .editor_support import EditorTestCase, fighter_body


class SharedSpecialEditorTests(EditorTestCase):
    def test_a_shared_special_is_linked_by_each_save_never_copied_or_changed(self) -> None:
        fear = Special.objects.create(name="Fear", type="Psychology", description="This model causes fear.")
        claw = Special.objects.create(name="Great Claw", type="Mutation", category=MUTATION, description="A claw.")
        TemplateFighterSpecial.objects.create(fighter=self.made.captain, special=fear, position=1)
        TemplateUpgrade.objects.filter(template=self.book).update(special=claw)
        specials = Special.objects.count()

        rules = [{"special_id": self.made.rule.id}, {"special_id": fear.id}]
        body = self.saved("fighters/captain/", fighter_body(name="Captain", rules=rules))
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        upgrade = {"group": "Mutations", "rule": {"special_id": claw.id}, "cost": 50, "later_double": True}
        self.saved("upgrades/", {"upgrades": [upgrade]}, template=version)

        self.assertNotEqual(version.pk, self.book.pk)  # the house version links the same rows
        captain = version.fighters.get(key="captain")
        self.assertEqual(list(captain.special_links.values_list("special_id", flat=True)), [self.made.rule.id, fear.id])
        self.assertEqual(list(version.upgrades.values_list("special_id", "cost")), [(claw.id, 50)])
        self.assertEqual(Special.objects.count(), specials)
        fear.refresh_from_db()
        claw.refresh_from_db()
        self.assertEqual(
            [(row.name, row.type, row.description, row.owner_kind, row.campaign_id) for row in (fear, claw)],
            [
                ("Fear", "Psychology", "This model causes fear.", GENERAL, None),
                ("Great Claw", "Mutation", "A claw.", GENERAL, None),
            ],
        )

    def test_a_rule_written_in_a_group_of_mutations_is_a_mutation(self) -> None:
        cult = WarbandTemplate.objects.filter(pk=self.book.pk)
        cult.update(name="Cult of the Possessed")
        written = {"name": "Third Eye", "description": "Sees all.", "kind": "boon"}  # no category picked

        self.saved("upgrades/", {"upgrades": [{"group": "Mutations", "rule": written, "cost": 20}]})

        made = Special.objects.get(name="Third Eye")
        self.assertEqual((made.type, made.category), ("Warband - Cult of the Possessed", MUTATION))
