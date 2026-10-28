"""What the catalogue's "Custom" and "House rule" badges read (CAT-NEW-03), on every list row and detail.

`replaces`: the book entry a version stands in for (null otherwise). With `campaign_id`, it tells a custom entry (a
campaign row replacing nothing) from a version. `archived_at`: since when the entry is archived, or, for a book
entry in a campaign's `?archived=1` list, removed from the campaign.
`updated_by` (a display name) and `updated_at`: who last wrote the entry through the catalogue, and when. `book`:
for a version, what the book says, for the tooltip ("Book: 5 gc"): the book entry's id and name, the fields the
version changed with the book's values, and an item's book price. Items also carry `generated_effect_key` (a house
rule's clone: "Set by Half price armour"). Every value comes from the row's own query (joins and one annotation),
so lists stay constant in rows.
"""

from typing import Any, ClassVar

from rest_framework import serializers

from apps.users.names import display_name

BADGES = ("replaces", "archived_at", "updated_by", "updated_at", "book")
STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
)
WHEN = serializers.DateTimeField()


def badge_joins() -> tuple[str, ...]:
    """The joins a row's badges read: its book entry and its writer."""
    return ("replaces", "updated_by")


class EntryBadges(serializers.Serializer):
    """The badge fields, for a catalogue row serializer to list in its Meta.fields (`BADGES`)."""

    book_fields: ClassVar[tuple[str, ...]] = ("name", "type", "description")  # the entry's, compared with the book's
    book_price: ClassVar[bool] = False  # an item: the book's lowest cost (the `book_price` annotation)

    replaces = serializers.SerializerMethodField()
    archived_at = serializers.SerializerMethodField()
    updated_by = serializers.SerializerMethodField()
    updated_at = serializers.SerializerMethodField()
    book = serializers.SerializerMethodField()

    def get_replaces(self, entry: Any) -> int | None:
        replaced: int | None = entry.replaces_id
        return replaced

    def get_archived_at(self, entry: Any) -> str | None:
        when = getattr(entry, "removed_at", None) or entry.archived_at
        return WHEN.to_representation(when) if when else None

    def get_updated_by(self, entry: Any) -> str | None:
        return display_name(entry.updated_by) if entry.updated_by_id else None

    def get_updated_at(self, entry: Any) -> str | None:
        return WHEN.to_representation(entry.updated_at) if entry.updated_at else None

    def get_book(self, entry: Any) -> dict[str, Any] | None:
        if not entry.replaces_id:
            return None
        book = entry.replaces
        summary: dict[str, Any] = {"id": book.pk, "name": book.name, "changes": _changes(entry, book, self.book_fields)}
        if self.book_price:
            summary["price"] = getattr(entry, "book_price", None)
        return summary


def _changes(row: Any, book: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    """The book's value of each of `fields` the row changed, by payload key (an item's `save_value` is "save")."""
    return {
        ("save" if field == "save_value" else field): getattr(book, field)
        for field in fields
        if getattr(row, field) != getattr(book, field)
    }


def with_badges(base: type[serializers.ModelSerializer], **options: Any) -> type[serializers.ModelSerializer]:
    """`base` with the badge fields after its own (`options`: `book_fields`, `book_price`)."""
    base_meta: Any = base.Meta
    meta = type("Meta", (base_meta,), {"fields": (*base_meta.fields, *BADGES)})
    made: type[serializers.ModelSerializer] = type(
        f"{base.__name__.removesuffix('Serializer')}RowSerializer",
        (EntryBadges, base),
        {"Meta": meta, "__module__": base.__module__, **options},
    )
    return made
