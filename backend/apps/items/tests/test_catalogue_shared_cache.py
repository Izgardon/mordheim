"""The shared catalogue cache (the workshop plan, "Speed and longevity"; apps/core/catalogue/sharing.py).

A campaign holding nothing of its own for a list (no entry, version, archived entry or removed book entry of the kind,
nor any in the tables its list reads too) is served the body every such campaign ticking the same settings shares,
every workshop alike, at the cost of the membership's one query. A campaign that writes its own entry, ticks another
setting or removes a book entry reads its own body from then on, and every write still retires what it changes.
"""

import io
from typing import Any
from unittest import mock

from django.core.cache import caches
from django.core.management import call_command

from apps.campaigns.in_play import Ticked, set_settings
from apps.campaigns.models import WORKSHOP, Campaign, CampaignType
from apps.core.catalogue import sharing
from apps.items.models import Item
from apps.skills.models import Skill, SkillGroupSkill

from .catalogue_support import ITEMS, SKILL_GROUPS, SKILLS
from .test_catalogue_list_cache import CatalogueListCacheTestCase


def shared_keys() -> list[str]:
    """The shared bodies the worker's cache holds."""
    held: Any = caches["catalogue"]
    return [key for key in held._cache if ":shared:" in key]  # LocMemCache keeps its keys in `_cache`


class SharedCacheTestCase(CatalogueListCacheTestCase):
    khemri: CampaignType

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.khemri = CampaignType.objects.create(slug="khemri-cache", name="Khemri (cache)", grade="1b", sort_order=9)
        Item.objects.filter(pk=cls.book_sword.pk).update(campaign_type=cls.khemri)
        for campaign in (cls.campaign, cls.elsewhere):
            set_settings(campaign, [])  # the always-on settings alone, alike

    def read_as(self, user: Any, url: str) -> tuple[Any, int]:
        self.client.force_authenticate(user=user)
        return self.read(url)

    def names_in(self, user: Any, url: str) -> list[str]:
        return [row["name"] for row in self.read_as(user, url)[0].json()]


class SharingTests(SharedCacheTestCase):
    def test_two_plain_campaigns_with_the_same_settings_share_one_body(self) -> None:
        mine, mine_queries = self.read_as(self.owner, ITEMS.list_url(self.campaign))
        theirs, theirs_queries = self.read_as(self.outsider, ITEMS.list_url(self.elsewhere))
        self.assertGreater(mine_queries, 1)  # read and stored
        self.assertEqual(theirs_queries, 1)  # the membership alone: the body was the first campaign's
        self.assertEqual(theirs.content, mine.content)
        self.assertEqual(len(shared_keys()), 1)
        self.assertFalse(next(row for row in theirs.json() if row["name"] == "Sword")["in_play"])

    def test_a_campaign_ticking_another_setting_reads_another_body(self) -> None:
        self.read_as(self.owner, ITEMS.list_url(self.campaign))
        set_settings(self.elsewhere, [self.khemri.pk])
        theirs, queries = self.read_as(self.outsider, ITEMS.list_url(self.elsewhere))
        self.assertGreater(queries, 1)
        self.assertTrue(next(row for row in theirs.json() if row["name"] == "Sword")["in_play"])
        self.assertEqual(len(shared_keys()), 2)

    def test_a_campaign_writing_its_own_entry_reads_its_own_body_and_nobody_else_sees_it(self) -> None:
        self.read_as(self.owner, SKILLS.list_url(self.campaign))
        made = self.post_as(self.owner, SKILLS.list_url(), SKILLS.body("Dirty Fighting", self.campaign))
        self.assertEqual(made.status_code, 201, made.data)
        self.assertIn("Dirty Fighting", self.names_in(self.owner, SKILLS.list_url(self.campaign)))
        theirs, queries = self.read_as(self.outsider, SKILLS.list_url(self.elsewhere))
        self.assertEqual(queries, 1)  # still the shared body
        self.assertNotIn("Dirty Fighting", [row["name"] for row in theirs.json()])
        self.assertEqual(self.read_as(self.owner, SKILLS.list_url(self.campaign))[1], 1)  # its own, cached

    def test_a_book_entry_removed_for_one_campaign_is_gone_from_its_list_alone(self) -> None:
        self.read_as(self.outsider, ITEMS.list_url(self.elsewhere))
        removed = self.delete_as(self.owner, f"{ITEMS.detail_url(self.book_axe.id)}?campaign_id={self.campaign.id}")
        self.assertIn(removed.status_code, (200, 204), getattr(removed, "data", None))
        self.assertNotIn("Axe", self.names_in(self.owner, ITEMS.list_url(self.campaign)))
        self.assertIn("Axe", self.names_in(self.outsider, ITEMS.list_url(self.elsewhere)))

    def test_a_skill_groups_list_follows_the_campaigns_version_of_a_skill(self) -> None:
        SkillGroupSkill.objects.create(group=self.combat, skill=self.infiltration[0])
        self.read_as(self.outsider, SKILL_GROUPS.list_url(self.elsewhere))
        edited = self.patch_as(
            self.owner, SKILLS.detail_url(self.infiltration[0].id), {"campaign_id": self.campaign.id, "name": "Sneak"}
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        version = Skill.objects.get(campaign=self.campaign, replaces=self.infiltration[0])
        self.assertTrue(Skill.objects.filter(campaign=self.campaign).exists())
        mine = self.read_as(self.owner, SKILL_GROUPS.list_url(self.campaign))[0].json()
        combat = next(row for row in mine if row["name"] == "Combat")
        self.assertIn(version.id, combat["skill_ids"])
        theirs = self.read_as(self.outsider, SKILL_GROUPS.list_url(self.elsewhere))[0].json()
        self.assertIn(self.infiltration[0].id, next(row for row in theirs if row["name"] == "Combat")["skill_ids"])

    def test_every_workshop_shares_one_body_with_every_setting_in_play(self) -> None:
        workshops = [self.post_as(user, "/api/workshop/").data["id"] for user in (self.player, self.rival)]
        self.assertEqual(Campaign.objects.filter(pk__in=workshops, kind=WORKSHOP).count(), 2)
        first, _ = self.read_as(self.player, ITEMS.list_url(workshops[0]))
        second, queries = self.read_as(self.rival, ITEMS.list_url(workshops[1]))
        self.assertEqual((queries, second.content), (1, first.content))
        self.assertTrue(all(row["in_play"] for row in second.json()))
        self.assertTrue(any(":shared:all:" in key for key in shared_keys()))

    def test_a_seed_retires_the_shared_bodies(self) -> None:
        before = self.names_in(self.owner, "/api/races/?campaign_id=" + str(self.campaign.id))
        call_command("seed_races", stdout=io.StringIO())
        after, queries = self.read_as(self.outsider, "/api/races/?campaign_id=" + str(self.elsewhere.id))
        self.assertGreater(queries, 1)
        self.assertGreater(len(after.json()), len(before))

    def test_a_shared_body_is_computed_from_the_book_alone(self) -> None:
        # a write that lands between the membership read and the rows read can never put a campaign's own entry into
        # the body others are served: the shared body reads the book's rows and the settings, never the campaign's
        Item.objects.create(name="Unbumped Charm", type="Misc", subtype="Misc", campaign=self.campaign)
        plain = mock.patch.object(sharing, "shared_scope", return_value=(Ticked(frozenset()), "racing"))
        with plain:
            names = self.names_in(self.owner, ITEMS.list_url(self.campaign))
        self.assertNotIn("Unbumped Charm", names)
        self.assertIn("Unbumped Charm", self.names_in(self.owner, ITEMS.list_url(self.campaign)))  # its own, unshared
