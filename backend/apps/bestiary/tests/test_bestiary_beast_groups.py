"""A henchmen group recruited from a creature holds its beast (`source_beast`, RESTRICT; the bestiary rewrite step 4).

The group is one of the bestiary's holders in the kinds registry: a beast a group came from is archived rather than
deleted (so back to item never dead-ends), counts the group in its usage, and a campaign's first edit of a book beast
moves the campaign's groups onto its version (Revert moves them back), as it moves the copies of its item, so "the
same beast" still matches when a group is joined.
"""

from apps.bestiary.models import BestiaryEntry
from apps.items.tests.catalogue_support import BESTIARY, make_beast
from apps.warbands.models import HenchmenGroup
from apps.warbands.tests.roster_support import HENCHMEN, make_unit

from .test_bestiary_animal_item_versions import NO_USE, BeastTestCase


class BeastGroupTests(BeastTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dogs = make_beast("Wardogs", kind="creature", available_in_shop=True, cost=25)
        self.group = make_unit(HENCHMEN, self.warband, name="Kennel", source_beast=self.dogs)

    def test_a_beast_a_group_came_from_is_archived_not_deleted(self):
        hounds = make_beast("Hounds", campaign=self.campaign, kind="creature", cost=20)
        make_unit(HENCHMEN, self.warband, name="Pack", source_beast=hounds)

        deleted = self.delete_as(self.owner, f"{BESTIARY.detail_url(hounds.id)}?campaign_id={self.campaign.id}")

        self.assertEqual(deleted.status_code, 200, deleted.data)
        self.assertEqual(deleted.json(), {"outcome": "archived", "usage": {**NO_USE, "units": 1, "warbands": 1}})
        self.assertIsNotNone(BestiaryEntry.objects.get(pk=hounds.pk).archived_at)

    def test_a_first_edit_moves_the_campaigns_groups_onto_the_version_and_revert_moves_them_back(self):
        version = self.patch_as(self.player, BESTIARY.detail_url(self.dogs.id), {"campaign_id": self.campaign.id, "name": "War Hounds"}).data  # fmt: skip

        self.assertEqual(HenchmenGroup.objects.get(pk=self.group.pk).source_beast_id, version["id"])

        self.post_as(self.player, f"{BESTIARY.detail_url(version['id'])}revert/")

        self.assertEqual(HenchmenGroup.objects.get(pk=self.group.pk).source_beast_id, self.dogs.id)
