"""The template editor's tests' fixtures: a book Mercenaries template (support.make_template) in the catalogue test
campaign, whose two warbands are Mercenaries, and the bodies its saves send."""

from typing import Any

from apps.items.tests.catalogue_support import CatalogueTestCase
from apps.warband_templates.models import WarbandTemplate

from .support import Made, make_template

LIST = "/api/warband-templates/"


def fighter_body(**changes: Any) -> dict[str, Any]:
    """A whole fighter as the Fighters save sends him: a 4-4-3-3-3-1-3-1-7 human with no lists or rules."""
    body: dict[str, Any] = {
        "name": "Sergeant",
        "plural": "Sergeants",
        "race_id": None,
        "cost": 35,
        "starting_xp": 8,
        "min_count": 0,
        "max_count": 2,
        "movement": 4,
        "weapon_skill": 4,
        "ballistic_skill": 3,
        "strength": 3,
        "toughness": 3,
        "wounds": 1,
        "initiative": 3,
        "attacks": 1,
        "leadership": 7,
        "skill_types": ["Combat"],
        "spell_types": [],
        "lists": [],
        "rules": [],
    }
    return {**body, **changes}


class EditorTestCase(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)

    @property
    def book(self) -> WarbandTemplate:
        return self.made.template

    def at(self, suffix: str = "", template: WarbandTemplate | int | None = None) -> str:
        """`/api/warband-templates/<id>/<suffix>` (the book template by default)."""
        found = template if template is not None else self.book
        return f"{LIST}{found if isinstance(found, int) else found.pk}/{suffix}"

    def save(self, suffix: str, body: dict[str, Any], *, method: str = "put", user: Any = None, **url: Any) -> Any:
        """A section save as `user` (the player, who holds `edit_catalogue`), for this campaign."""
        self.client.force_authenticate(user=user or self.player)
        send = getattr(self.client, method)
        return send(self.at(suffix, **url), {"campaign_id": self.campaign.id, **body}, format="json")

    def saved(self, suffix: str, body: dict[str, Any], **options: Any) -> dict[str, Any]:
        response = self.save(suffix, body, **options)
        self.assertIn(response.status_code, (200, 201), response.data)
        answer: dict[str, Any] = response.json()
        return answer
