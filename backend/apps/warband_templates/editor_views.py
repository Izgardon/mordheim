"""The template editor's routes (the templates plan, phase 4), on the catalogue's entry view (apps/core/catalogue):
access is the catalogue's, so whoever can edit the catalogue edits templates (`edit_catalogue`, no new permission), a
member reads, and an archived campaign is read only. A book template is written for one campaign (`campaign_id` in
the body, or the query for a DELETE).

`GET <id>/editor/` is the template, the header's facts and the warnings; `GET <id>/who-can/` what the warband types it
serves can usually buy, for the Lists' Add an item. Each section saves on its own (`PUT <id>/basics/`, `POST
<id>/fighters/` and `PUT`/`DELETE <id>/fighters/<key>/`, the same for lists, `PUT <id>/rules/` and `PUT <id>/upgrades/`):
a book template's first save makes the campaign's house version (versions.editable, with every child row) in the same
transaction, and every save answers what the editor reads, whose `template.id` the page follows."""

from collections.abc import Callable
from typing import Any

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from apps.core.catalogue import names, versions
from apps.core.catalogue.hooks import CampaignRequired
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.views import CatalogueEntryView
from apps.core.catalogue.writes import catalogue_write

from .editor_fighter_serializers import EquipmentListSerializer, FighterSerializer
from .editor_serializers import BasicsSerializer, RulesSerializer, UpgradesSerializer
from .models import WarbandTemplate
from .services import edit_basics, edit_fighters, edit_lists, edit_rules
from .services.editor import current_template, editor_payload
from .services.template_who_can import template_offers

EDIT = "edit_catalogue"


class TemplateReadView(CatalogueEntryView):
    """A read for one campaign: a book template's needs `?campaign_id=`."""

    kind = WARBAND_TEMPLATES
    rules = {"GET": "view"}
    book_methods = frozenset({"GET"})
    reads_detail = False

    def campaign(self) -> int:
        if self.campaign_id is None:
            raise CampaignRequired()
        return self.campaign_id


class TemplateEditorView(TemplateReadView):
    def get(self, request: Request, **kwargs: Any) -> Response:
        campaign_id = self.campaign()
        template = current_template(self.entry, campaign_id)
        return Response(editor_payload(template.pk, campaign_id, self.access.settings))


class TemplateWhoCanView(TemplateReadView):
    def get(self, request: Request, **kwargs: Any) -> Response:
        return Response(template_offers(self.entry, self.campaign()))


class TemplateSectionView(CatalogueEntryView):
    """A section's save: the house version first for a book template, then the write, in one transaction."""

    kind = WARBAND_TEMPLATES
    rules = {"PUT": EDIT, "POST": EDIT, "DELETE": EDIT}
    book_methods = frozenset({"PUT", "POST", "DELETE"})
    actions = {"PUT": "edit", "POST": "edit", "DELETE": "edit"}
    reads_detail = False

    def body(self, serializer: type[Serializer[Any]]) -> Any:
        sent = serializer(data=self.request.data, context={"campaign_id": self.campaign_id})
        sent.is_valid(raise_exception=True)
        return sent.validated_data

    def save(self, write: Callable[[WarbandTemplate], Any], name: str | None = None, created: bool = False) -> Response:
        campaign_id = self.campaign_id
        assert campaign_id is not None  # load_scope found it
        names.check_edit(self.kind, self.entry, campaign_id, name)
        allowed = [self.entry.pk, self.entry.replaces_id or self.entry.pk]
        with catalogue_write(self.kind, campaign_id, name, allowed, self.socket_id()):
            template = versions.editable(self.kind, self.entry, campaign_id)
            write(template)
            WarbandTemplate.objects.filter(pk=template.pk).update(
                updated_by=self.request.user, updated_at=timezone.now()
            )
        body = editor_payload(template.pk, campaign_id, self.access.settings)
        return Response(body, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class BasicsView(TemplateSectionView):
    def put(self, request: Request, **kwargs: Any) -> Response:
        data = self.body(BasicsSerializer)
        campaign_id = self.campaign_id
        assert campaign_id is not None  # load_scope found it
        template = current_template(self.entry, campaign_id)
        if edit_basics.unchanged(template, data):  # no change, no house version: answered as a read
            return Response(editor_payload(template.pk, campaign_id, self.access.settings))
        return self.save(lambda template: edit_basics.write_basics(template, data), name=data["name"])


class FightersView(TemplateSectionView):
    def post(self, request: Request, **kwargs: Any) -> Response:
        data = self.body(FighterSerializer)
        data.setdefault("kind", "hero")
        return self.save(lambda template: edit_fighters.add_fighter(template, data), created=True)


class FighterView(TemplateSectionView):
    def put(self, request: Request, fighter_key: str, **kwargs: Any) -> Response:
        data = self.body(FighterSerializer)
        return self.save(lambda template: edit_fighters.write_fighter(template, fighter_key, data))

    def delete(self, request: Request, fighter_key: str, **kwargs: Any) -> Response:
        return self.save(lambda template: edit_fighters.remove_fighter(template, fighter_key))


class ListsView(TemplateSectionView):
    def post(self, request: Request, **kwargs: Any) -> Response:
        data = self.body(EquipmentListSerializer)
        return self.save(lambda template: edit_lists.add_list(template, data), created=True)


class ListView(TemplateSectionView):
    def put(self, request: Request, list_key: str, **kwargs: Any) -> Response:
        data = self.body(EquipmentListSerializer)
        return self.save(lambda template: edit_lists.write_list(template, list_key, data))

    def delete(self, request: Request, list_key: str, **kwargs: Any) -> Response:
        return self.save(lambda template: edit_lists.remove_list(template, list_key))


class RulesView(TemplateSectionView):
    def put(self, request: Request, **kwargs: Any) -> Response:
        data = self.body(RulesSerializer)
        return self.save(lambda template: edit_rules.write_rules(template, data["rules"]))


class UpgradesView(TemplateSectionView):
    def put(self, request: Request, **kwargs: Any) -> Response:
        data = self.body(UpgradesSerializer)
        return self.save(lambda template: edit_rules.write_upgrades(template, data["upgrades"]))
