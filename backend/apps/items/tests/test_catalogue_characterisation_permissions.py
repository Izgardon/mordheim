"""Characterisation: who may create, edit and delete each catalogue kind today (pass 5; BUG-15, BUG-82, CAT-TEST-03).

Creating an item, skill, spell or special needs `add_custom` (joining grants it); editing and deleting it need that
kind's `manage_*` code. The bestiary and hired swords need `manage_bestiary` for all three. Races let any member
create and only owners and admins edit; nothing deletes a race. Owners and admins hold every code. Book entries
can't be edited or deleted. PR A replaces the codes with one `edit_catalogue` (decision 4) plus `delete_catalogue`
(decision 5), checked by every catalogue write, races included.

Pass 4 seeded `manage_spells` and renamed `manage_features` to `manage_specials`, so every code checked here exists
and can be granted (the brief's "unseeded codes" predates that).
"""

from typing import Any

from django.utils import timezone

from apps.campaigns.models import Campaign

from .catalogue_support import (
    BESTIARY,
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

ADD_CUSTOM_KINDS = tuple(kind for kind in KINDS if kind.create_code == "add_custom")  # items, skills, spells, specials
ARCHIVED = {
    "detail": "This campaign is archived, so nothing in it can change. Its owner can restore it.",
    "code": "campaign_archived",
    "fields": {},
}


class CataloguePermissionTestCase(CatalogueTestCase):
    def entry(self, kind: CatalogueKind, name: str | None = None) -> Any:
        return make_entry(kind, name or f"House {kind.key}", campaign=self.campaign)

    def edit(self, user: Any, kind: CatalogueKind, entry: Any) -> int:
        return int(self.patch_as(user, kind.detail_url(entry.id), {"name": "Renamed"}).status_code)

    def delete(self, user: Any, kind: CatalogueKind, entry: Any) -> int:
        return int(self.delete_as(user, kind.detail_url(entry.id)).status_code)

    def exists(self, kind: CatalogueKind, entry: Any) -> bool:
        return kind.model._default_manager.filter(id=entry.id).exists()


class CatalogueCreatePermissionTests(CataloguePermissionTestCase):
    def test_a_player_creates_items_skills_spells_and_specials_with_the_code_joining_grants(self):
        self.assertEqual(self.codes(self.player), ["add_custom"])
        self.assertEqual([kind.key for kind in ADD_CUSTOM_KINDS], ["items", "skills", "spells", "specials"])
        for kind in ADD_CUSTOM_KINDS:
            with self.subTest(kind=kind.key):
                response = self.create_as(self.player, kind, f"Pia's {kind.key}")

                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["campaign_id"], self.campaign.id)

    def test_without_add_custom_a_player_creates_none_of_them(self):
        self.revoke(self.player, "add_custom")
        for kind in ADD_CUSTOM_KINDS:
            with self.subTest(kind=kind.key):
                response = self.create_as(self.player, kind, "Refused")
                self.assertEqual((response.status_code, response.data), (403, {"detail": "Forbidden"}))
                self.assertFalse(kind.model._default_manager.filter(name="Refused").exists())

    def test_the_bestiary_and_hired_swords_need_manage_bestiary_even_to_create(self):
        for kind in (BESTIARY, HIRED_SWORDS):
            with self.subTest(kind=kind.key):
                refused = self.create_as(self.player, kind, f"Pia's {kind.key}")
                self.assertEqual((refused.status_code, refused.data), (403, {"detail": "Forbidden"}))
        self.grant(self.player, "manage_bestiary")
        for kind in (BESTIARY, HIRED_SWORDS):
            with self.subTest(kind=kind.key, granted=True):
                self.assertEqual(self.create_as(self.player, kind, f"Pia's {kind.key}").status_code, 201)

    def test_any_member_creates_a_race_without_any_code(self):
        # Characterises current behaviour (BUG-82, pinned; flips in PR A: races need edit_catalogue)
        self.revoke(self.player, "add_custom")

        response = self.create_as(self.player, RACES, "Halfling")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["name"], response.data["campaign_id"]), ("Halfling", self.campaign.id))

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
                self.assertEqual((created.status_code, created.data), (403, ARCHIVED))
                self.assertEqual((edited.status_code, edited.data), (403, ARCHIVED))
        self.assertEqual(self.listed(self.player, ITEMS)[0], "House items")  # reads still work


class CatalogueEditPermissionTests(CataloguePermissionTestCase):
    def test_a_player_cannot_edit_or_delete_the_entry_they_created(self):
        # Characterises current behaviour (BUG-15, CAT-TEST-03, pinned; flips in PR A: edit_catalogue covers both)
        for kind in ADD_CUSTOM_KINDS:
            with self.subTest(kind=kind.key):
                created = self.create_as(self.player, kind, f"Pia's typo {kind.key}")
                entry = kind.model._default_manager.get(id=created.data["id"])

                self.assertEqual(
                    (self.edit(self.player, kind, entry), self.delete(self.player, kind, entry)), (403, 403)
                )
                self.assertTrue(self.exists(kind, entry))

    def test_each_kinds_manage_code_unlocks_its_edit_and_delete_and_no_other(self):
        for kind in ADD_CUSTOM_KINDS:
            with self.subTest(kind=kind.key):
                others = [other for other in ADD_CUSTOM_KINDS if other is not kind]
                self.grant(self.player, kind.edit_code or "")
                for other in others:
                    self.assertEqual(self.edit(self.player, other, self.entry(other, f"Other {kind.key}")), 403)

                entry = self.entry(kind)
                self.assertEqual(
                    (self.edit(self.player, kind, entry), self.delete(self.player, kind, entry)), (200, 204)
                )
                self.revoke(self.player, kind.edit_code or "")

    def test_manage_bestiary_edits_and_deletes_bestiary_entries_and_hired_swords(self):
        for kind in (BESTIARY, HIRED_SWORDS):
            with self.subTest(kind=kind.key):
                entry = self.entry(kind)
                self.assertEqual(
                    (self.edit(self.player, kind, entry), self.delete(self.player, kind, entry)), (403, 403)
                )
        self.grant(self.player, "manage_bestiary")
        for kind in (BESTIARY, HIRED_SWORDS):
            with self.subTest(kind=kind.key, granted=True):
                entry = self.entry(kind, f"Granted {kind.key}")
                self.assertEqual(
                    (self.edit(self.player, kind, entry), self.delete(self.player, kind, entry)), (200, 204)
                )
                self.assertFalse(self.exists(kind, entry))

    def test_owners_and_admins_edit_and_delete_every_kind_but_races_cannot_be_deleted(self):
        for user in (self.owner, self.admin):
            for kind in KINDS:
                with self.subTest(user=user.first_name, kind=kind.key):
                    entry = self.entry(kind, f"{user.first_name} {kind.key}")
                    expected_delete = 204 if kind.deletable else 405
                    self.assertEqual(
                        (self.edit(user, kind, entry), self.delete(user, kind, entry)), (200, expected_delete)
                    )

    def test_only_owners_and_admins_edit_a_race_whatever_codes_a_player_holds(self):
        # Characterises current behaviour (BUG-82, pinned; flips in PR A: edit_catalogue, and a guarded delete)
        race = self.entry(RACES)
        self.grant(self.player, "manage_items", "manage_skills", "manage_spells", "manage_specials", "manage_bestiary")

        self.assertEqual(self.edit(self.player, RACES, race), 403)
        self.assertEqual(self.put_as(self.admin, RACES.detail_url(race.id), RACES.body("Ogre")).status_code, 200)
        self.assertEqual(self.delete(self.owner, RACES, race), 405)
        race.refresh_from_db()
        self.assertEqual(race.name, "Ogre")

    def test_book_entries_cannot_be_edited_or_deleted_even_by_the_owner(self):
        books = {
            ITEMS: self.book_axe,
            SKILLS: self.infiltration[0],
            SPELLS: self.lifestealer[0],
            SPECIALS: self.large,
            RACES: self.human,
            BESTIARY: self.warhound,
            HIRED_SWORDS: self.ogre,
        }
        for kind, book in books.items():
            with self.subTest(kind=kind.key):
                edited = self.edit(self.owner, kind, book)
                deleted = self.delete(self.owner, kind, book)
                # a book race is "Not found" to the race detail, which only reads campaign races
                self.assertEqual((edited, deleted), (404, 405) if kind is RACES else (403, 403))
                self.assertTrue(self.exists(kind, book))

    def test_non_members_get_404s_and_a_missing_entry_is_a_404(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                entry = self.entry(kind)
                expected_delete = 404 if kind.deletable else 405
                self.assertEqual((self.edit(self.outsider, kind, entry), self.delete(self.outsider, kind, entry)), (404, expected_delete))  # fmt: skip
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


class ItemPropertyPermissionTests(CataloguePermissionTestCase):
    def test_adding_a_property_needs_add_custom_and_a_campaign(self):
        url = "/api/item-properties/"
        body = {"campaign_id": self.campaign.id, "name": "Cleave", "type": "Weapon"}

        self.assertEqual(self.post_as(self.player, url, body).status_code, 201)
        self.assertEqual(self.post_as(self.outsider, url, body).status_code, 404)
        missing = self.post_as(self.owner, url, {"name": "Cleave"})
        self.assertEqual((missing.status_code, missing.data), (400, {"detail": "campaign_id is required"}))
        self.revoke(self.player, "add_custom")
        self.assertEqual(self.post_as(self.player, url, body).status_code, 403)

    def test_properties_cannot_be_edited_or_deleted(self):
        url = f"/api/item-properties/{self.parry.id}/"

        self.assertEqual(self.patch_as(self.owner, url, {"name": "Riposte"}).status_code, 405)
        self.assertEqual(self.delete_as(self.owner, url).status_code, 405)
        self.assertEqual(self.get_as(self.player, url).data["name"], "Parry")
