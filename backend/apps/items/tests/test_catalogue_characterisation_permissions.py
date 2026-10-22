"""Who may create, edit and delete each catalogue kind (pass 5; BUG-15, BUG-82, CAT-TEST-03, CAT-TEST-27).

Since PR A one code, `edit_catalogue`, covers creating and editing every kind (items, skills, spells, specials,
races, bestiary entries, hired swords, dramatis personae) and adding item properties; joining grants it (decision 4). Deleting needs
`delete_catalogue`, which joining doesn't grant (decision 5). Owners and admins hold both. Before, creating needed
`add_custom`, editing and deleting a per-kind `manage_*` code (so a player couldn't fix his own typo), any member
created a race and only owners and admins edited one, and nothing deleted a race. Book entries can't be edited or
deleted; an archived campaign refuses every catalogue write.
"""

from typing import Any

from django.utils import timezone

from apps.campaigns.models import Campaign
from apps.warbands.tests.roster_support import HERO, make_unit

from .catalogue_support import (
    BESTIARY,
    DELETE,
    DRAMATIS_PERSONAE,
    EDIT,
    HIRED_SWORDS,
    ITEMS,
    KINDS,
    RACES,
    SKILLS,
    SPECIALS,
    SPELLS,
    CatalogueKind,
    CatalogueTestCase,
    make_entry,
)

ARCHIVED = {
    "detail": "This campaign is archived, so nothing in it can change. Its owner can restore it.",
    "code": "campaign_archived",
    "fields": {},
}
FORBIDDEN = {"detail": "Forbidden"}


class CataloguePermissionTestCase(CatalogueTestCase):
    def entry(self, kind: CatalogueKind, name: str | None = None) -> Any:
        return make_entry(kind, name or f"House {kind.key}", campaign=self.campaign)

    def edit(self, user: Any, kind: CatalogueKind, entry: Any) -> int:
        return int(self.patch_as(user, kind.detail_url(entry.id), {"name": f"Renamed {entry.id}"}).status_code)

    def delete(self, user: Any, kind: CatalogueKind, entry: Any) -> int:
        return int(self.delete_as(user, kind.detail_url(entry.id)).status_code)

    def exists(self, kind: CatalogueKind, entry: Any) -> bool:
        return kind.model._default_manager.filter(id=entry.id).exists()


class CatalogueCreatePermissionTests(CataloguePermissionTestCase):
    def test_a_player_creates_every_kind_with_the_code_joining_grants(self):
        self.assertEqual(self.codes(self.player), [EDIT])
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                response = self.create_as(self.player, kind, f"Pia's {kind.key}")

                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["campaign_id"], self.campaign.id)

    def test_without_edit_catalogue_a_player_creates_nothing_races_included(self):
        # BUG-82 (was pinned: any member created a race without any code; flipped in PR A)
        self.revoke(self.player, EDIT)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                response = self.create_as(self.player, kind, "Refused")
                self.assertEqual((response.status_code, response.data), (403, FORBIDDEN))
                self.assertFalse(kind.model._default_manager.filter(name="Refused").exists())

    def test_owners_and_admins_create_every_kind(self):
        for user in (self.owner, self.admin):
            for kind in KINDS:
                with self.subTest(user=user.first_name, kind=kind.key):
                    self.assertEqual(self.create_as(user, kind, f"{user.first_name}'s {kind.key}").status_code, 201)

    def test_non_members_and_writes_without_a_campaign_are_404s(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                outsider = self.create_as(self.outsider, kind, "Intruder")
                no_campaign = self.post_as(self.owner, kind.list_url(), kind.body("Nowhere"))
                self.assertEqual((outsider.status_code, outsider.data), (404, {"detail": "Not found"}))
                self.assertEqual((no_campaign.status_code, no_campaign.data), (404, {"detail": "Not found"}))

    def test_invalid_bodies_are_400s_and_write_nothing(self):
        cases: list[tuple[CatalogueKind, dict[str, Any], str]] = [
            (ITEMS, {"name": ""}, "name"),
            (ITEMS, {"type": ""}, "type"),
            (SKILLS, {"description": ""}, "description"),
            (SPELLS, {"type": ""}, "type"),
            (SPECIALS, {"name": ""}, "name"),
            (RACES, {"name": "   "}, "name"),
            (RACES, {"movement": 11}, "movement"),
            (BESTIARY, {"type": ""}, "type"),
            (HIRED_SWORDS, {"name": ""}, "name"),
            (DRAMATIS_PERSONAE, {"stays": "forever"}, "stays"),
        ]
        for kind, overrides, field in cases:
            with self.subTest(kind=kind.key, field=field):
                before = kind.model._default_manager.count()
                body = {**kind.body("Broken", self.campaign), **overrides}

                response = self.post_as(self.owner, kind.list_url(), body)

                self.assertEqual((response.status_code, list(response.data)), (400, [field]))
                self.assertEqual(kind.model._default_manager.count(), before)

    def test_an_archived_campaign_refuses_every_catalogue_write(self):
        entries = {kind.key: self.entry(kind) for kind in KINDS}
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                created = self.create_as(self.owner, kind, "Too late")
                edited = self.patch_as(self.owner, kind.detail_url(entries[kind.key].id), {"name": "Too late"})
                deleted = self.delete_as(self.owner, kind.detail_url(entries[kind.key].id))
                self.assertEqual((created.status_code, created.data), (403, ARCHIVED))
                self.assertEqual((edited.status_code, edited.data), (403, ARCHIVED))
                self.assertEqual((deleted.status_code, deleted.data), (403, ARCHIVED))
        self.assertEqual(self.listed(self.player, ITEMS)[0], "House items")  # reads still work


class CatalogueEditPermissionTests(CataloguePermissionTestCase):
    def test_a_player_edits_any_campaign_entry_but_deletes_none(self):
        # BUG-15, CAT-TEST-03 (was pinned: a player couldn't edit or delete the entry they had created; flipped in
        # PR A: edit_catalogue edits every campaign entry, his or not; deleting needs delete_catalogue)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                created = self.create_as(self.player, kind, f"Pia's typo {kind.key}")
                mine = kind.model._default_manager.get(id=created.data["id"])
                theirs = self.entry(kind, f"Rex's {kind.key}")

                self.assertEqual((self.edit(self.player, kind, mine), self.edit(self.player, kind, theirs)), (200, 200))
                self.assertEqual(self.delete(self.player, kind, mine), 403)
                self.assertTrue(self.exists(kind, mine))

    def test_delete_catalogue_lets_a_player_delete_every_kind(self):
        self.grant(self.player, DELETE)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                entry = self.entry(kind)
                self.assertEqual(self.delete(self.player, kind, entry), 204)
                self.assertFalse(self.exists(kind, entry))

    def test_owners_and_admins_edit_and_delete_every_kind_races_included(self):
        for user in (self.owner, self.admin):
            for kind in KINDS:
                with self.subTest(user=user.first_name, kind=kind.key):
                    entry = self.entry(kind, f"{user.first_name} {kind.key}")
                    self.assertEqual((self.edit(user, kind, entry), self.delete(user, kind, entry)), (200, 204))

    def test_races_are_edited_and_deleted_under_the_catalogue_codes(self):
        # BUG-82 (was pinned: only owners and admins edited a race, whatever codes a player held, and nothing
        # deleted one; flipped in PR A); a race in use is archived (BUG-130; it answered 409 in_use before PR C)
        race = self.entry(RACES)
        used = self.entry(RACES, "Ogre")
        make_unit(HERO, self.warband, name="Brute", race=used)

        self.assertEqual(self.edit(self.player, RACES, race), 200)
        self.assertEqual(self.put_as(self.player, RACES.detail_url(race.id), RACES.body("Gnome")).status_code, 200)
        self.assertEqual(self.delete(self.player, RACES, race), 403)
        self.grant(self.player, DELETE)
        archived = self.delete_as(self.player, RACES.detail_url(used.id))
        self.assertEqual((archived.status_code, archived.json()["outcome"], archived.json()["usage"]["units"]), (200, "archived", 1))  # fmt: skip
        self.assertEqual(self.delete(self.player, RACES, race), 204)
        self.assertTrue(self.exists(RACES, used))

    def test_the_book_itself_is_edited_or_deleted_by_nobody_even_the_owner(self):
        books = {
            ITEMS: self.book_axe,
            SKILLS: self.infiltration[0],
            SPELLS: self.lifestealer[0],
            SPECIALS: self.large,
            RACES: self.human,
            BESTIARY: self.warhound,
            HIRED_SWORDS: self.ogre,
            DRAMATIS_PERSONAE: self.aenur,
        }
        for kind, book in books.items():
            with self.subTest(kind=kind.key):
                edited = self.edit(self.owner, kind, book)
                deleted = self.delete(self.owner, kind, book)
                # without a campaign to make a version in, a write to a book entry is refused (a book race was a 404
                # before races had versions, PR C)
                self.assertEqual((edited, deleted), (403, 403))
                self.assertTrue(self.exists(kind, book))

    def test_non_members_get_404s_and_a_missing_entry_is_a_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                entry = self.entry(kind)
                self.assertEqual((self.edit(self.outsider, kind, entry), self.delete(self.outsider, kind, entry)), (404, 404))  # fmt: skip
                missing = self.patch_as(self.owner, kind.detail_url(999999), {"name": "Ghost"})
                self.assertEqual(missing.status_code, 404)

    def test_an_entry_of_another_campaign_is_a_404_to_its_non_members(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                theirs = make_entry(kind, f"Their {kind.key}", campaign=self.elsewhere)
                self.assertEqual(self.edit(self.owner, kind, theirs), 404)

    def test_a_race_edit_naming_another_campaign_is_a_404(self):
        race = self.entry(RACES)

        response = self.patch_as(self.owner, RACES.detail_url(race.id), {"campaign_id": self.elsewhere.id, "name": "X"})

        self.assertEqual(response.status_code, 404)

    def test_a_revoked_player_is_refused_every_catalogue_write(self):
        # CAT-TEST-27: the owner (or an admin) takes edit_catalogue away in Members; every catalogue write is refused
        self.revoke(self.player, EDIT)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                entry = self.entry(kind, f"Kept {kind.key}")
                self.assertEqual(self.create_as(self.player, kind, "Refused").status_code, 403)
                self.assertEqual((self.edit(self.player, kind, entry), self.delete(self.player, kind, entry)), (403, 403))  # fmt: skip
                # PR C: a book entry's version, Revert and Restore need edit_catalogue too
                book = make_entry(kind, f"Book {kind.key}")
                version = make_entry(kind, f"Version {kind.key}", campaign=self.campaign, replaces=book)
                writes = [
                    self.patch_as(
                        self.player, kind.detail_url(book.id), {"campaign_id": self.campaign.id, "name": "X"}
                    ),
                    self.post_as(self.player, f"{kind.detail_url(version.id)}revert/"),
                    self.post_as(self.player, f"{kind.detail_url(entry.id)}restore/"),
                ]
                self.assertEqual([response.status_code for response in writes], [403, 403, 403])
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "type": "Weapon"}
        self.assertEqual(self.post_as(self.player, "/api/item-properties/", body).status_code, 403)
        self.assertEqual(self.create_as(self.rival, SKILLS, "Rex still adds").status_code, 201)


class ItemPropertyPermissionTests(CataloguePermissionTestCase):
    def test_adding_a_property_needs_edit_catalogue_and_a_campaign(self):
        url = "/api/item-properties/"
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "type": "Weapon"}

        self.assertEqual(self.post_as(self.player, url, body).status_code, 201)
        self.assertEqual(self.post_as(self.outsider, url, body).status_code, 404)
        missing = self.post_as(self.owner, url, {"name": "Cleave"})
        self.assertEqual((missing.status_code, missing.data), (400, {"detail": "campaign_id is required"}))
        self.revoke(self.player, EDIT)
        self.assertEqual(self.post_as(self.player, url, body).status_code, 403)

    def test_properties_cannot_be_edited_or_deleted(self):
        url = f"/api/item-properties/{self.parry.id}/"

        self.assertEqual(self.patch_as(self.owner, url, {"name": "Riposte"}).status_code, 405)
        self.assertEqual(self.delete_as(self.owner, url).status_code, 405)
        self.assertEqual(self.get_as(self.player, url).data["name"], "Parry")
