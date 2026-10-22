"""No two entries of a kind share a name in a campaign's catalogue (pass 5 PR C; decisions 1 and 2, CAT-TWEAK-02,
CAT-TEST-24).

A create whose name, trimmed and in any case, any type, is already a book entry's or one of the campaign's (archived
ones included) answers 400 `name_taken` listing every match; each kind has its own names (an animal, a hired sword
and a dramatis persona may share one).
Another campaign's names don't count. An edit may keep its own name, or take back the name of the book entry it
replaces; renaming onto any other entry is refused the same way. PR A's `duplicate_entry` is retired: an exact
duplicate is a taken name, and two creates of one name at once meet the database's constraint, which answers the
same.
"""

from typing import Any
from unittest import mock

from django.utils import timezone

from apps.bestiary.models import BestiaryEntry
from apps.core.models import CatalogueRemoval

from .catalogue_support import (
    BESTIARY,
    DRAMATIS_PERSONAE,
    HIRED_SWORDS,
    INFILTRATION_TYPES,
    ITEMS,
    KINDS,
    RACES,
    SKILLS,
    CatalogueKind,
    CatalogueTestCase,
    make_entry,
)


def count(kind: CatalogueKind, name: str) -> int:
    return int(kind.model._default_manager.filter(name__iexact=name).count())


class CreateNameTests(CatalogueTestCase):
    def refused(self, response: Any) -> list[dict[str, Any]]:
        self.assertEqual((response.status_code, response.json()["code"]), (400, "name_taken"), response.data)
        self.assertEqual(list(response.json()["fields"]), ["name"])
        matches: list[dict[str, Any]] = response.json()["matches"]
        return matches

    def test_a_book_name_is_taken_in_any_case_and_type_and_lists_every_match(self):
        matches = self.refused(self.create_as(self.player, SKILLS, "  infiltration ", type="Combat"))

        self.assertEqual(
            sorted((match["kind"], match["type"], match["source"], match["archived"]) for match in matches),
            sorted(("skills", kind, "book", False) for kind in INFILTRATION_TYPES),
        )
        self.assertEqual({match["name"] for match in matches}, {"Infiltration"})
        self.assertEqual({match["id"] for match in matches}, {skill.id for skill in self.infiltration})
        detail = self.create_as(self.player, SKILLS, "Infiltration", type="Combat").json()["detail"]
        self.assertEqual(detail, "Infiltration is already in the catalogue: Dark Elf, Sea Ghosts and 4 more. Edit one instead.")  # fmt: skip

    def test_every_kind_refuses_a_campaign_or_book_name_and_writes_nothing(self):
        books = {
            ITEMS: "Axe",
            RACES: "Human",
            BESTIARY: "Warhound",
            HIRED_SWORDS: "Ogre Bodyguard",
            DRAMATIS_PERSONAE: "Aenur",
        }
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.assertEqual(self.create_as(self.owner, kind, f"Twin {kind.key}").status_code, 201)
                again = self.create_as(self.owner, kind, f"TWIN {kind.key}")
                [match] = self.refused(again)
                self.assertEqual((match["source"], match["kind"]), ("campaign", kind.key))
                self.assertEqual(count(kind, f"Twin {kind.key}"), 1)
                if kind in books:
                    self.assertEqual(self.refused(self.create_as(self.owner, kind, books[kind]))[0]["source"], "book")

    def test_archived_and_removed_entries_are_taken_too_and_say_so(self):
        make_entry(SKILLS, "Ambush", campaign=self.campaign, archived_at=timezone.now())
        CatalogueRemoval.objects.create(campaign=self.campaign, kind="skills", entry_id=self.infiltration[0].id)

        [archived] = self.refused(self.create_as(self.player, SKILLS, "Ambush"))
        removed = self.refused(self.create_as(self.player, SKILLS, "Infiltration"))

        self.assertEqual((archived["source"], archived["archived"]), ("campaign", True))
        self.assertEqual([match["archived"] for match in removed if match["id"] == self.infiltration[0].id], [True])

    def test_an_animal_a_hired_sword_and_a_dramatis_persona_each_keep_their_own_names(self):
        # the bestiary rewrite: hired swords are no longer bestiary entries, so they no longer share its names
        created = [self.create_as(self.owner, kind, "Wolf").status_code for kind in (BESTIARY, HIRED_SWORDS, DRAMATIS_PERSONAE)]  # fmt: skip

        [match] = self.refused(self.create_as(self.owner, HIRED_SWORDS, "wolf"))
        ogre = self.refused(self.create_as(self.owner, HIRED_SWORDS, "ogre bodyguard"))

        self.assertEqual(created, [201, 201, 201])
        self.assertEqual((match["kind"], match["type"], match["source"]), ("hired_swords", None, "campaign"))
        self.assertEqual([(entry["kind"], entry["id"]) for entry in ogre], [("hired_swords", self.ogre.id)])
        self.assertEqual(BestiaryEntry.objects.filter(name="Wolf").count(), 1)

    def test_another_campaigns_names_are_free(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                make_entry(kind, f"Theirs {kind.key}", campaign=self.elsewhere)
                self.assertEqual(self.create_as(self.owner, kind, f"Theirs {kind.key}").status_code, 201)

    def test_two_creates_of_one_name_at_once_meet_the_constraint_and_answer_the_same(self):
        # the second create got past the name check before the first one's row was there
        self.assertEqual(self.create_as(self.owner, SKILLS, "Feint").status_code, 201)
        with mock.patch("apps.core.catalogue.names.check_create"):
            again = self.create_as(self.owner, SKILLS, "Feint")

        self.assertEqual([match["source"] for match in self.refused(again)], ["campaign"])
        self.assertEqual(count(SKILLS, "Feint"), 1)


class EditNameTests(CatalogueTestCase):
    def test_an_edit_keeps_its_own_name_in_any_case(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                entry = make_entry(kind, f"Mine {kind.key}", campaign=self.campaign)
                response = self.patch_as(self.owner, kind.detail_url(entry.id), {"name": f"MINE {kind.key}"})
                self.assertEqual(response.status_code, 200, response.data)

    def test_renaming_onto_another_entry_is_refused_and_changes_nothing(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                make_entry(kind, f"Taken {kind.key}", campaign=self.campaign)
                entry = make_entry(kind, f"Free {kind.key}", campaign=self.campaign)

                response = self.patch_as(self.owner, kind.detail_url(entry.id), {"name": f"taken {kind.key}"})

                self.assertEqual((response.status_code, response.json()["code"]), (400, "name_taken"))
                self.assertEqual(count(kind, f"Free {kind.key}"), 1)

    def test_a_version_keeps_its_book_entrys_name_and_may_take_it_back(self):
        book_url = SKILLS.detail_url(self.infiltration[0].id)
        first = self.patch_as(self.player, book_url, {"campaign_id": self.campaign.id, "name": "Infiltration"})
        renamed = self.patch_as(self.player, SKILLS.detail_url(first.data["id"]), {"name": "Sneaking"})
        back = self.patch_as(self.player, SKILLS.detail_url(first.data["id"]), {"name": "infiltration"})
        onto = self.patch_as(self.player, SKILLS.detail_url(first.data["id"]), {"name": "Sprint"})

        self.assertEqual((first.status_code, renamed.status_code, back.status_code), (200, 200, 200))
        self.assertEqual((onto.status_code, onto.json()["code"]), (400, "name_taken"))
        self.assertEqual(self.patch_as(self.player, book_url, {"campaign_id": self.campaign.id, "name": "Infiltration"}).status_code, 200)  # fmt: skip
