"""Shared fixtures for the catalogue characterisation tests (pass 5).

The `test_catalogue_characterisation_*` modules lock in how the catalogue behaves today (the item, skill, spell,
special, race, restriction, bestiary, hired-sword and dramatis-persona endpoints, the seeders, and how prices, pickers and trait
specials find a campaign's entries) before PR A fixes it, PR B moves it onto generic views and PR C adds versions.
Known bugs are pinned with their BUGS.md ID and the comment "Characterises current behaviour (BUG-NN, pinned; flips
in PR A)" (or the PR that changes it); a test written as the fixed behaviour is an `expectedFailure`.

Every catalogue table has a nullable `campaign`: NULL is the book (seeded), a value is that campaign's own entry.
"""

from dataclasses import dataclass, field
from typing import Any

from django.conf import settings
from django.db.models import Model
from django.test.utils import override_settings

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign, CampaignMembershipPermission
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.items.models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty, ItemPropertyLink
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

STATS = {
    "movement": 4,
    "weapon_skill": 3,
    "ballistic_skill": 3,
    "strength": 3,
    "toughness": 3,
    "wounds": 1,
    "initiative": 3,
    "attacks": 1,
    "leadership": 7,
}

# The six book skill types that share the name "Infiltration" in skills.json.
INFILTRATION_TYPES = ("Dark Elf", "Sea Ghosts", "Skaven", "Skaven Metal Mongers", "Skink", "Strigany")
EDIT = "edit_catalogue"  # create and edit every kind; joining grants it (decision 4)
DELETE = "delete_catalogue"  # delete every kind; owners and admins, and players granted it (decision 5)


@dataclass(frozen=True, eq=False)  # compared and hashed by identity: one object per kind
class CatalogueKind:
    """One catalogue kind as its endpoints see it.

    Since PR A every kind is created and edited under `edit_catalogue` and deleted under `delete_catalogue`
    (decisions 4 and 5), races included. `name_path` is where a list row keeps its name.
    """

    key: str
    path: str
    model: type[Model]
    name_path: tuple[str, ...] = ("name",)
    payload: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.key

    def list_url(self, campaign: Campaign | int | str | None = None) -> str:
        url = f"/api/{self.path}/"
        if campaign is None:
            return url
        return f"{url}?campaign_id={campaign.id if isinstance(campaign, Campaign) else campaign}"

    def detail_url(self, pk: int) -> str:
        return f"/api/{self.path}/{pk}/"

    def body(self, name: str, campaign: Campaign | None = None, **overrides: Any) -> dict[str, Any]:
        """A valid create body for an entry called `name`."""
        body = {"name": name, **self.payload, **overrides}
        if campaign is not None:
            body["campaign_id"] = campaign.id
        return body

    def row_name(self, row: dict[str, Any]) -> str:
        value: Any = row
        for key in self.name_path:
            value = value[key]
        return str(value)


ITEMS = CatalogueKind(
    "items",
    "items",
    Item,
    payload={"type": "Weapon", "subtype": "Melee", "availabilities": [{"cost": 25, "rarity": 2}]},
)
SKILLS = CatalogueKind(
    "skills",
    "skills",
    Skill,
    payload={"type": "Combat", "description": "Strikes first."},
)
SPELLS = CatalogueKind(
    "spells",
    "spells",
    Spell,
    payload={"type": "Lesser Magic", "description": "A bolt of light.", "dc": "7"},
)
SPECIALS = CatalogueKind(
    "specials",
    "special",
    Special,
    payload={"type": "Ability", "description": "Never panics."},
)
RACES = CatalogueKind("races", "races", Race, payload=dict(STATS))
BESTIARY = CatalogueKind(
    "bestiary",
    "bestiary",
    BestiaryEntry,
    payload={"kind": "creature", **STATS},
)
HIRED_SWORDS = CatalogueKind(
    "hired_swords",
    "hired-swords",
    HiredSword,
    payload={"hire_cost": 30, "upkeep_cost": 15, "rating": 12, **STATS},
)
DRAMATIS_PERSONAE = CatalogueKind(
    "dramatis_personae",
    "dramatis-personae",
    DramatisPersona,
    payload={"hire_cost": 25, "stays": "one_battle", "payment_note": "25 gc or 1 shard", **STATS},
)
KINDS = (ITEMS, SKILLS, SPELLS, SPECIALS, RACES, BESTIARY, HIRED_SWORDS, DRAMATIS_PERSONAE)


def make_entry(kind: CatalogueKind, name: str, /, campaign: Campaign | None = None, **fields: Any) -> Any:
    """A catalogue row written directly (`campaign` None: a book row; a bestiary entry's `kind` is a field)."""
    if kind is ITEMS:
        values = {"type": "Weapon", "subtype": "Melee", **fields}
        cost = values.pop("cost", 5)
        item = Item.objects.create(name=name, campaign=campaign, **values)
        if cost is not None:
            ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
        return item
    defaults: dict[str, dict[str, Any]] = {
        SKILLS.key: {"type": "Combat"},
        SPELLS.key: {"type": "Lesser Magic"},
        SPECIALS.key: {"type": "Ability"},
        RACES.key: dict(STATS),
        BESTIARY.key: {"kind": "creature", **STATS},
        HIRED_SWORDS.key: {"hire_cost": 40, **STATS},
        DRAMATIS_PERSONAE.key: {"hire_cost": 25, **STATS},
    }
    return kind.model._default_manager.create(name=name, campaign=campaign, **{**defaults[kind.key], **fields})


def make_beast(name: str, campaign: Campaign | None = None, cost: int | None = None, **fields: Any) -> BestiaryEntry:
    """A bestiary entry with its Animal item, written directly as the seeder and the bestiary writes leave them: the
    item in the beast's campaign, named after it, its subtype the kind's label, listed when the beast is sold, at
    `cost` (no price when None)."""
    beast: BestiaryEntry = make_entry(BESTIARY, name, campaign=campaign, **fields)
    item = Item.objects.create(
        name=name,
        campaign=campaign,
        type="Animal",
        subtype=beast.get_kind_display(),
        listed=beast.available_in_shop,
        bestiary_entry=beast,
    )
    if cost is not None:
        ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
    return beast


class CatalogueTestCase(CampaignTestCase):
    """CampaignTestCase ("Shards": owner Olga, admin Ada, players Pia and Rex holding only `edit_catalogue`, outsider Otto
    with his own campaign `elsewhere`) plus a small book catalogue:

    the Axe (Weapon, 5 gc), the Sword (Weapon, 10 gc) and Heavy Armour (Armour, 50 gc); "Infiltration" in the six
    book skill types; "Lifestealer" in two spell lores; the trait specials Large (Trait), Wizard and Priest (Caster);
    the race Human; the restriction "Mercenaries"; the property Parry; the bestiary's Warhound (a creature); the hired
    sword Ogre Bodyguard (80 gc); and the dramatis persona Aenur (25 gc).
    """

    book_axe: Item
    book_sword: Item
    heavy_armour: Item
    infiltration: list[Skill]
    lifestealer: list[Spell]
    large: Special
    human: Race
    mercenaries: Restriction
    parry: ItemProperty
    warhound: BestiaryEntry
    ogre: HiredSword
    aenur: DramatisPersona

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.mercenaries = Restriction.objects.create(type="Warband", restriction="Mercenaries")
        cls.parry = ItemProperty.objects.create(name="Parry", type="Weapon", description="Parries a blow.")
        cls.book_axe = make_entry(ITEMS, "Axe", cost=5)
        cls.book_sword = make_entry(ITEMS, "Sword", cost=10)
        ItemPropertyLink.objects.create(item=cls.book_sword, property=cls.parry)
        ItemAvailabilityRestriction.objects.create(
            item_availability=cls.book_sword.availabilities.get(), restriction=cls.mercenaries
        )
        cls.heavy_armour = make_entry(ITEMS, "Heavy Armour", type="Armour", subtype="Armour", save_value="5+", cost=50)
        cls.infiltration = [Skill.objects.create(name="Infiltration", type=kind) for kind in INFILTRATION_TYPES]
        Skill.objects.create(name="Sprint", type="Speed")
        Skill.objects.create(name="New Skill", type="Pending")  # the placeholder a level-up picks later
        cls.lifestealer = [
            Spell.objects.create(name="Lifestealer", type=lore) for lore in ("Necromancy", "Necromancy (Restless Dead)")
        ]
        cls.large = Special.objects.create(name="Large", type="Trait")
        Special.objects.create(name="Wizard", type="Caster")
        Special.objects.create(name="Priest", type="Caster")
        cls.human = make_entry(RACES, "Human")
        cls.warhound = make_entry(BESTIARY, "Warhound")
        cls.ogre = make_entry(HIRED_SWORDS, "Ogre Bodyguard", hire_cost=80)
        cls.aenur = make_entry(DRAMATIS_PERSONAE, "Aenur")

    # Requests

    def create_as(self, user: Any, kind: CatalogueKind, name: str, /, **overrides: Any) -> Any:
        """POST a new `name` entry of `kind` into this campaign as `user`."""
        return self.post_as(user, kind.list_url(), kind.body(name, self.campaign, **overrides))

    def listed(self, user: Any, kind: CatalogueKind, campaign: Campaign | None = None) -> list[str]:
        """The names `user` sees in the kind's list for `campaign` (this campaign by default), in order."""
        response = self.get_as(user, kind.list_url(campaign or self.campaign))
        self.assertEqual(response.status_code, 200, response.data)
        return [kind.row_name(row) for row in response.json()]

    def revoke(self, user: Any, *codes: str) -> None:
        """Take permission codes away from a member directly."""
        CampaignMembershipPermission.objects.filter(
            membership=self.membership(user), permission__code__in=codes
        ).delete()


def catalogue_cache_on() -> override_settings:
    """The catalogue list cache on, as in production (the test runner turns it off: config/test_runner.py). Clear
    `caches["catalogue"]` in setUp: the cache outlives each test's rollback."""
    locmem = {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "catalogue-tests"}
    return override_settings(CACHES={**settings.CACHES, "catalogue": locmem})
