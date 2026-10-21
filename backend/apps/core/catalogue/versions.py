"""A campaign's versions of book entries (decisions 1 and 2, CAT-TWEAK-01): copy-on-write, edits in place, Revert.

Editing a book entry in a campaign copies it, with its child rows (`kind.children`), into the campaign with
`replaces` set, and moves the campaign's copies onto the copy (remap.py); the edit is then applied to the copy, in
the catalogue write's one transaction. The book row is locked first, so two first edits at once make one version
(the second edits the first's version in place). Later edits change the version in place. Revert moves the copies
back, records the reverted id (open battles still name it: current.py) and deletes the version. Both keep the
copies' stored costs, and both cost the same whatever the number of copies. A hired sword's version is its entry's,
with the entry's profile; links a copy carries to other entries point at the campaign's versions of those.
"""

from typing import Any

from django.db.models import Model
from django.db.models.fields.related import ForeignObjectRel
from rest_framework.exceptions import NotFound

from apps.core.errors import ApiError
from apps.core.models import CatalogueEntry, RevertedVersion

from .current import is_entry_table
from .kinds import CatalogueKindSpec, entry_kind
from .remap import remap

NOT_A_VERSION = "This entry isn't a campaign's version of a book entry, so there is nothing to revert."


def entry_of(kind: CatalogueKindSpec, row: Any) -> Any:
    """The row of the entry table a kind's row is: itself, or a hired sword's bestiary entry."""
    return getattr(row, kind.entry_via) if kind.entry_via else row


def row_of(kind: CatalogueKindSpec, entry: Any) -> Any:
    """The kind's row for an entry-table row: itself, or the hired sword whose entry it is."""
    if not kind.entry_via:
        return entry
    return kind.hooks.write_rows(kind).get(**{kind.entry_via: entry})


def editable(kind: CatalogueKindSpec, row: Any, campaign_id: int) -> Any:
    """The row an edit in the campaign writes: a custom entry or a version itself (locked, so a Revert can't take it
    mid-edit); for a book entry, the campaign's version of it, made by this first edit."""
    entry = entry_of(kind, row)
    owner = entry_kind(kind)
    manager = owner.model._default_manager
    if entry.campaign_id is not None:
        if entry.replaces_id is not None and not manager.select_for_update().filter(pk=entry.pk).exists():
            raise NotFound("Not found")  # reverted while this edit was on its way
        return row
    book = manager.select_for_update().get(pk=entry.pk)
    version = manager.filter(campaign_id=campaign_id, replaces=book).first()
    if version is None:
        version = copy_entry(owner, book, campaign_id)
        remap(owner, campaign_id, {book.pk: version.pk}, fresh=True)
    owner.hooks.refuse_write(version)  # a house rule's clone (pass 4: its rule owns it)
    return row_of(kind, version)


def revert(kind: CatalogueKindSpec, row: Any, campaign_id: int) -> Any:
    """Revert the campaign's version (a book id: the campaign's version of it); the book entry's row of the kind."""
    entry = entry_of(kind, row)
    owner = entry_kind(kind)
    manager = owner.model._default_manager
    if entry.campaign_id is None:
        entry = manager.filter(campaign_id=campaign_id, replaces=entry).first() or entry
    if entry.replaces_id is None:
        raise ApiError(NOT_A_VERSION, code="not_a_version", status=409)
    owner.hooks.refuse_write(entry)
    version = manager.select_for_update().filter(pk=entry.pk).first()
    if version is not None:
        retire(owner, campaign_id, [version])
    return row_of(kind, manager.get(pk=entry.replaces_id))


def retire(kind: CatalogueKindSpec, campaign_id: int, versions: list[Any]) -> None:
    """Move the campaign's copies of each version back to the book entry it replaces, record it, delete it (a Revert,
    and a house rule's clones going: the same path)."""
    id_map = {version.pk: version.replaces_id for version in versions if version.replaces_id}
    if not id_map:
        return
    remap(kind, campaign_id, id_map)
    RevertedVersion.objects.bulk_create(
        [
            RevertedVersion(campaign_id=campaign_id, kind=kind.key, version_id=version_id, book_id=book_id)
            for version_id, book_id in id_map.items()
        ],
        ignore_conflicts=True,
    )
    kind.model._default_manager.filter(pk__in=list(id_map)).delete()


def copy_entry(kind: CatalogueKindSpec, source: Model, campaign_id: int) -> Model:
    """A copy of the book entry `source` in the campaign, replacing it, with every child row (parents first)."""
    clone = _copied(source, None, campaign_id, replaces_id=source.pk)
    _point_at_versions([clone], campaign_id, skip="replaces_id")
    clone.save(force_insert=True)
    copied: dict[str, dict[Any, Any]] = {"": {source.pk: clone.pk}}
    for path in kind.children:
        parent, _, name = path.rpartition("__")
        relation = _model_at(kind.model, parent)._meta.get_field(name)
        assert isinstance(relation, ForeignObjectRel)
        copied[path] = _copy_children(relation, copied[parent], campaign_id)
    return clone


def _model_at(model: type[Model], path: str) -> type[Model]:
    for step in filter(None, path.split("__")):
        model = model._meta.get_field(step).related_model  # type: ignore[assignment]
    return model


def _copy_children(relation: ForeignObjectRel, parents: dict[Any, Any], campaign_id: int) -> dict[Any, Any]:
    """The rows of `relation` under the copied parents, copied under their copies in one INSERT; old id -> new."""
    model: Any = relation.related_model
    link = relation.field.attname
    rows = list(model._default_manager.filter(**{f"{link}__in": list(parents)}).order_by("pk"))
    if not rows:
        return {}
    clones = [_copied(row, link, campaign_id, **{link: parents[getattr(row, link)]}) for row in rows]
    _point_at_versions(clones, campaign_id, skip=link)
    made = model._default_manager.bulk_create(clones)
    return {row.pk: copy.pk for row, copy in zip(rows, made, strict=True)}


def _copied(row: Model, link: str | None, campaign_id: int, **changes: Any) -> Model:
    """An unsaved copy of `row` in the campaign: no add-on (versions keep `campaign_type` null), never archived."""
    names = {field.name for field in row._meta.concrete_fields}
    values = {
        field.attname: getattr(row, field.attname) for field in row._meta.concrete_fields if not field.primary_key
    }
    if "campaign" in names:
        values["campaign_id"] = campaign_id
    if "campaign_type" in names:
        values["campaign_type_id"] = None
    if isinstance(row, CatalogueEntry):
        values.update(archived_at=None, archived_by_id=None, updated_at=None, updated_by_id=None)
    return type(row)(**{**values, **changes})


def _point_at_versions(rows: list[Model], campaign_id: int, *, skip: str) -> None:
    """Links the copies carry to other entries (an equipment item, a skill, an item's animal) point at the campaign's
    version of each where it has one: one query per kind of link."""
    for field in rows[0]._meta.concrete_fields:
        target: Any = getattr(field, "related_model", None)
        if field.attname == skip or not is_entry_table(target):
            continue
        ids = {getattr(row, field.attname) for row in rows} - {None}
        if not ids:
            continue
        versions = dict(
            target._default_manager.filter(campaign_id=campaign_id, replaces_id__in=ids).values_list(
                "replaces_id", "pk"
            )
        )
        for row in rows:
            setattr(row, field.attname, versions.get(getattr(row, field.attname), getattr(row, field.attname)))
