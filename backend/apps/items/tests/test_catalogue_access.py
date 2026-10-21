"""One permission pattern for every catalogue route (design 0.29, IMP-79): the endpoint x role matrix, and the
structure that keeps catalogue views on the generic base and the kinds registry complete.

Actors: `player` ("Pia", only what joining grants: edit_catalogue), `rival` ("Rex", a player also granted
delete_catalogue), `admin`, `owner`, the outsider ("Otto", in another campaign) and anonymous (401 everywhere).
Book lists and book entries need only a login, and a write to a book entry names the campaign it is for (none: 403);
a campaign's list, create or entry is a 404 to a non-member. Each request runs in a savepoint that is rolled back,
so a DELETE doesn't change what the next row sees.
"""

from typing import Any

from django.db import transaction
from django.db.models import CASCADE, RESTRICT, ForeignKey, ManyToOneRel
from django.urls import URLPattern, get_resolver, resolve
from django.utils import timezone

from apps.campaigns.access import CAMPAIGN_RULES
from apps.campaigns.models import Campaign
from apps.core.catalogue.kinds import CATALOGUE_KINDS, LIST_KINDS
from apps.core.catalogue.views import CatalogueScopedView
from apps.items.models import ItemProperty
from apps.warbands.access import WARBAND_RULES
from apps.warbands.views.base import WarbandScopedView

from .catalogue_support import DELETE, HIRED_SWORDS, KINDS, RACES, CatalogueKind, CatalogueTestCase, make_entry

ACTORS = ("player", "rival", "admin", "owner", "outsider")
Row = tuple[str, str, dict[str, Any] | None, tuple[int, int, int, int, int]]
EDITED: dict[str, dict[str, Any]] = {"races": {"movement": 5}}  # every other kind: a new description
CATALOGUE_APPS = ("items", "skills", "spells", "special", "races", "restrictions", "bestiary")
FAVOURITES = {"warband-bestiary-favourites", "warband-bestiary-favourite-delete"}  # warband routes


class CatalogueAccessFixture(CatalogueTestCase):
    """The shared catalogue, one campaign entry of each kind, the campaign's version of a spare book entry of each
    kind, a campaign property, and `rival` granted deleting."""

    house: dict[str, int]
    version: dict[str, int]

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.house = {kind.key: make_entry(kind, f"House {kind.key}", campaign=cls.campaign).id for kind in KINDS}
        cls.house["property"] = ItemProperty.objects.create(name="Spiked", type="Weapon", campaign=cls.campaign).id
        cls.version = {}
        for kind in KINDS:
            spare = make_entry(kind, f"Spare {kind.key}")
            book = spare.bestiary_entry if kind is HIRED_SWORDS else spare
            cls.version[kind.key] = make_entry(kind, f"Spare {kind.key}", campaign=cls.campaign, replaces=book).id

    def setUp(self) -> None:
        super().setUp()
        self.grant(self.rival, DELETE)

    def books(self) -> dict[str, int]:
        entries = [self.book_axe, self.infiltration[0], self.lifestealer[0], self.large, self.human, self.warhound]
        return {
            **{kind.key: entry.pk for kind, entry in zip(KINDS[:6], entries, strict=True)},
            "hired_swords": self.ogre.id,
        }

    def kind_rows(self, kind: CatalogueKind) -> list[Row]:
        books, house, edit = self.books(), self.house[kind.key], EDITED.get(kind.key, {"description": "Edited"})
        book, version, campaign = (
            kind.detail_url(books[kind.key]),
            kind.detail_url(self.version[kind.key]),
            self.campaign.id,
        )
        races = kind is RACES  # no detail read (405)
        return [
            ("GET", kind.list_url(self.campaign), None, (200, 200, 200, 200, 404)),
            ("GET", kind.list_url(), None, (200, 200, 200, 200, 200)),  # the book: a login is enough
            ("POST", kind.list_url(), kind.body(f"New {kind.key}", self.campaign), (201, 201, 201, 201, 404)),
            ("GET", kind.detail_url(house), None, (405,) * 5 if races else (200, 200, 200, 200, 404)),
            ("PATCH", kind.detail_url(house), edit, (200, 200, 200, 200, 404)),
            ("DELETE", kind.detail_url(house), None, (403, 204, 204, 204, 404)),
            ("GET", book, None, (405 if races else 200,) * 5),
            ("PATCH", book, edit, (403,) * 5),  # the book itself: nobody
            ("DELETE", book, None, (403,) * 5),
            ("PATCH", book, {**edit, "campaign_id": campaign}, (200, 200, 200, 200, 404)),  # the campaign's version
            ("POST", f"{version}revert/", None, (200, 200, 200, 200, 404)),
            ("POST", f"{kind.detail_url(house)}revert/", None, (409, 409, 409, 409, 404)),  # not a version
            ("POST", f"{book}revert/", {"campaign_id": campaign}, (409, 409, 409, 409, 404)),  # no version of it
            ("POST", f"{book}revert/", None, (403,) * 5),
        ]

    def matrix(self) -> list[Row]:
        campaign, prop = self.campaign.id, self.house["property"]
        favourites = f"/api/warbands/{self.warband.id}/bestiary-favourites/"
        return [
            *(row for kind in KINDS for row in self.kind_rows(kind)),
            ("PUT", RACES.detail_url(self.house["races"]), RACES.body("Gnome"), (200, 200, 200, 200, 404)),
            ("GET", f"/api/restrictions/?campaign_id={campaign}", None, (200, 200, 200, 200, 404)),
            ("GET", "/api/restrictions/", None, (200,) * 5),
            ("POST", "/api/restrictions/", {"restriction": "Junk"}, (405,) * 5),  # SEC-06
            ("GET", f"/api/item-properties/?campaign_id={campaign}", None, (200, 200, 200, 200, 404)),
            ("POST", "/api/item-properties/", {"campaign_id": campaign, "name": "Cleave"}, (201, 201, 201, 201, 404)),
            ("GET", f"/api/item-properties/{prop}/", None, (200, 200, 200, 200, 404)),
            ("GET", f"/api/item-properties/{self.parry.id}/", None, (200,) * 5),
            ("PATCH", f"/api/item-properties/{prop}/", {"name": "Barbed"}, (405,) * 5),
            ("GET", favourites, None, (200, 200, 200, 200, 404)),  # Pia's warband
            ("POST", favourites, {"bestiary_entry_id": self.warhound.id}, (201, 403, 201, 201, 404)),
            ("DELETE", f"{favourites}{self.warhound.id}/", None, (204, 403, 204, 204, 404)),
        ]

    def status_of(self, user: Any, method: str, url: str, body: dict[str, Any] | None = None) -> int:
        """The request's status, with everything it wrote rolled back."""
        self.client.force_authenticate(user=user)  # None: anonymous
        with transaction.atomic():
            response = getattr(self.client, method.lower())(url, body or {}, format="json")
            transaction.set_rollback(True)
        return int(response.status_code)


class CatalogueAccessMatrixTests(CatalogueAccessFixture):
    def test_every_catalogue_route_answers_each_actor_as_before(self):
        for method, url, body, expected in self.matrix():
            for actor, status in zip(ACTORS, expected, strict=True):
                with self.subTest(route=f"{method} {url}", actor=actor):
                    self.assertEqual(self.status_of(getattr(self, actor), method, url, body), status)

    def test_anonymous_gets_401_everywhere(self):
        for method, url, body, _expected in self.matrix():
            with self.subTest(route=f"{method} {url}"):
                self.assertEqual(self.status_of(None, method, url, body), 401)

    def test_the_matrix_covers_every_method_of_every_catalogue_route(self):
        covered = {(resolve(url.split("?")[0]).url_name, method) for method, url, _body, _expected in self.matrix()}
        for pattern in catalogue_patterns():
            view = pattern.callback.view_class  # type: ignore[attr-defined]
            for method in ("get", "post", "put", "patch", "delete"):
                if hasattr(view, method):
                    with self.subTest(route=pattern.name, method=method):
                        self.assertIn((pattern.name, method.upper()), covered)

    def test_an_archived_campaign_refuses_every_catalogue_write_the_owner_could_make(self):
        # decision 5: item properties and favourites too
        Campaign.objects.filter(id=self.campaign.id).update(archived_at=timezone.now())
        for method, url, body, expected in self.matrix():
            if method != "GET" and expected[3] < 300:
                with self.subTest(route=f"{method} {url}"):
                    self.assertEqual(self.status_of(self.owner, method, url, body), 403)


def catalogue_patterns() -> list[URLPattern]:
    patterns = [
        entry
        for app in CATALOGUE_APPS
        for entry in get_resolver(f"apps.{app}.urls").url_patterns
        if isinstance(entry, URLPattern)
    ]
    assert len(patterns) == 26, [pattern.name for pattern in patterns]
    return patterns


class CatalogueStructureTests(CatalogueTestCase):
    """New catalogue views can't skip the check, and the kinds registry names every table that holds an entry."""

    def test_every_catalogue_route_uses_the_generic_base(self):
        for pattern in catalogue_patterns():
            view = pattern.callback.view_class  # type: ignore[attr-defined]
            base = WarbandScopedView if pattern.name in FAVOURITES else CatalogueScopedView
            with self.subTest(route=pattern.name):
                self.assertTrue(issubclass(view, base))

    def test_every_handled_method_names_a_known_rule(self):
        for pattern in catalogue_patterns():
            view = pattern.callback.view_class  # type: ignore[attr-defined]
            known = WARBAND_RULES if pattern.name in FAVOURITES else CAMPAIGN_RULES
            for method in ("get", "post", "put", "patch", "delete"):
                if hasattr(view, method):
                    with self.subTest(route=pattern.name, method=method):
                        self.assertIn(view.rules.get(method.upper()), known)

    def test_each_kinds_holders_are_the_tables_that_reference_it_with_restrict(self):
        for kind in CATALOGUE_KINDS.values():
            restricting = {
                (rel.related_model, rel.field.name)
                for rel in kind.model._meta.related_objects
                if isinstance(rel, ManyToOneRel) and rel.on_delete is RESTRICT and rel.field.name != "replaces"
            }  # a version's `replaces` isn't a copy: Revert, not a delete, is how a version goes
            with self.subTest(kind=kind.key):
                self.assertEqual({(holder.model, holder.field) for holder in kind.holders}, restricting)

    def test_each_kinds_children_are_rows_it_carries(self):
        for kind in LIST_KINDS.values():
            for path in kind.children:
                model = kind.model
                for step in path.split("__"):
                    rel = model._meta.get_field(step)
                    with self.subTest(kind=kind.key, child=path):
                        self.assertIsInstance(rel, ManyToOneRel)
                        self.assertIsInstance(rel.remote_field, ForeignKey)
                        self.assertIs(rel.on_delete, CASCADE)  # type: ignore[union-attr]
                    model = rel.related_model  # type: ignore[assignment]
