"""Pointing a copy's catalogue links at what the campaign it lands in uses (the workshop plan's imports).

A copied row's link to a catalogue entry (an item, skill, spell, special, race or beast) becomes the target
campaign's current entry for it (`core/catalogue/current.py`): a book entry stands for itself, or for the target's
version of it. A link to one of the source campaign's own entries is looked up in `own` (what the copy made of it: a
list's own rules copied with the list), else, for a version, as the book entry it replaces; anything else can't be
used there and is left out, which the warnings say. A target where an entry is not in play (its setting isn't ticked)
warns too and links it all the same: restrictions warn, they never block.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Model, Q

from apps.campaigns.models import CampaignCampaignType, CampaignType
from apps.core.catalogue.current import current_rows, is_entry_table

Warning = dict[str, Any]


def entry_links(model: type[Model]) -> list[tuple[str, type[Model], bool]]:
    """The model's links to catalogue entries: (attname, entry model, nullable)."""
    found = []
    for field in model._meta.concrete_fields:
        target: Any = getattr(field, "related_model", None)
        if is_entry_table(target) and field.name != "replaces":
            found.append((field.attname, target, bool(field.null)))
    return found


class Relinker:
    """The target's id for each source entry id, read once per entry model for every row of a copy."""

    def __init__(self, campaign_id: int, own: Mapping[type[Model], Mapping[int, int]] | None = None) -> None:
        self.campaign_id = campaign_id
        self.own = {model: dict(ids) for model, ids in (own or {}).items()}
        self.ids: dict[type[Model], dict[int, int | None]] = {}
        self.rows: dict[type[Model], dict[int, Any]] = {}  # target id -> its row, for the warnings
        self.left_out: list[str] = []

    def prepare(self, rows_by_model: Mapping[type[Model], Iterable[Model]]) -> None:
        """Read the target's entry for every link the rows hold (one or two queries per entry model)."""
        wanted: dict[type[Model], set[int]] = {}
        for model, rows in rows_by_model.items():
            links = entry_links(model)
            for row in rows:
                for attname, target, _ in links:
                    value = getattr(row, attname)
                    if value is not None:
                        wanted.setdefault(target, set()).add(value)
        for target, ids in wanted.items():
            self._resolve(target, ids)

    def _resolve(self, model: type[Model], ids: set[int]) -> None:
        mapped = self.ids.setdefault(model, {})
        own = self.own.get(model, {})
        mapped.update({old: own[old] for old in ids if old in own})
        rest = ids - set(mapped)
        current = current_rows(model._default_manager.all(), rest, self.campaign_id)
        mapped.update({old: row.pk for old, row in current.items()})
        self.rows.setdefault(model, {}).update({row.pk: row for row in current.values()})
        missing = rest - set(current)
        if not missing:
            return
        foreign = list(model._default_manager.filter(pk__in=missing).values_list("pk", "replaces_id", "name"))
        books = {pk: book for pk, book, _ in foreign if book is not None}
        found = current_rows(model._default_manager.all(), set(books.values()), self.campaign_id) if books else {}
        self.rows[model].update({row.pk: row for row in found.values()})
        for pk, book, name in foreign:
            target = found.get(book) if book is not None else None
            mapped[pk] = target.pk if target is not None else None
            if target is None:
                self.left_out.append(str(name))

    def target(self, model: type[Model], source_id: int | None) -> int | None:
        if source_id is None:
            return None
        return self.ids.get(model, {}).get(source_id)

    def relink(self, row: Model) -> bool:
        """Point the (unsaved) copy's links at the target's entries; False when a link it can't do without is
        gone (the copy is left out)."""
        for attname, model, nullable in entry_links(type(row)):
            source_id = getattr(row, attname)
            if source_id is None:
                continue
            target = self.target(model, source_id)
            if target is None and not nullable:
                return False
            setattr(row, attname, target)
        return True

    def note(self, row: Model) -> None:
        """Check one more row the copy uses (its warband type) for the not-in-play warning."""
        self.rows.setdefault(type(row), {})[row.pk] = row

    def warnings(self) -> list[Warning]:
        """Entries not in play in the target, and entries left out, in the server's words (one query)."""
        warnings: list[Warning] = []
        in_play = set(
            CampaignType.objects.filter(
                Q(always_on=True)
                | Q(pk__in=CampaignCampaignType.objects.filter(campaign_id=self.campaign_id).values("campaign_type_id"))
            ).values_list("pk", flat=True)
        )
        off = sorted(
            {
                str(row.name)
                for rows in self.rows.values()
                for row in rows.values()
                if getattr(row, "campaign_type_id", None) is not None and row.campaign_type_id not in in_play
            }
        )
        if off:
            names = ", ".join(off)
            warnings.append({"code": "not_in_play", "message": f"Not in play in this campaign: {names}.", "names": off})
        if self.left_out:
            names = ", ".join(sorted(set(self.left_out)))
            message = f"Left out, as this campaign can't use them: {names}."
            warnings.append({"code": "left_out", "message": message, "names": sorted(set(self.left_out))})
        return warnings
