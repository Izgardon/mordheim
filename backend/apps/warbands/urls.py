from django.urls import path

from apps.warband_templates.views import WarbandTemplateForWarbandView, WarbandTypeTemplateView

from .units.kinds import HENCHMEN_GROUP, HERO, HIRELING
from .units.urls import unit_urlpatterns
from .views import (
    CampaignWarbandTypesView,
    WarbandBeastRecruitView,
    WarbandDetailView,
    WarbandGroupListView,
    WarbandItemListView,
    WarbandItemSaleView,
    WarbandItemTransferView,
    WarbandListCreateView,
    WarbandLogListView,
    WarbandPurchaseView,
    WarbandRarityRollView,
    WarbandResourceDetailView,
    WarbandResourceListCreateView,
    WarbandResourceSaleView,
    WarbandRuleDetailView,
    WarbandRuleFromTemplateView,
    WarbandRuleListCreateView,
    WarbandSheetView,
    WarbandSummaryView,
    WarbandTradeDetailView,
    WarbandTradeListCreateView,
    WarbandWhoCanView,
)

urlpatterns = [
    path("campaigns/<int:campaign_id>/warband-types/", CampaignWarbandTypesView.as_view(), name="warband-types"),
    path(
        "campaigns/<int:campaign_id>/warband-types/<int:warband_type_id>/template/",
        WarbandTypeTemplateView.as_view(),
        name="warband-type-template",
    ),
    path("warband-groups/", WarbandGroupListView.as_view(), name="warband-groups"),
    path("warbands/", WarbandListCreateView.as_view(), name="warbands"),
    path("warbands/<int:warband_id>/", WarbandDetailView.as_view(), name="warbands-detail"),
    path(
        "warbands/<int:warband_id>/summary/",
        WarbandSummaryView.as_view(),
        name="warbands-summary",
    ),
    path(
        "warbands/<int:warband_id>/sheet/",
        WarbandSheetView.as_view(),
        name="warbands-sheet",
    ),
    path(
        "warbands/<int:warband_id>/items/",
        WarbandItemListView.as_view(),
        name="warbands-items",
    ),
    path(
        "warbands/<int:warband_id>/item-transfers/",
        WarbandItemTransferView.as_view(),
        name="warbands-item-transfers",
    ),
    path(
        "warbands/<int:warband_id>/item-sales/",
        WarbandItemSaleView.as_view(),
        name="warbands-item-sales",
    ),
    path(
        "warbands/<int:warband_id>/purchases/",
        WarbandPurchaseView.as_view(),
        name="warbands-purchases",
    ),
    path("warbands/<int:warband_id>/who-can/", WarbandWhoCanView.as_view(), name="warbands-who-can"),
    path("warbands/<int:warband_id>/template/", WarbandTemplateForWarbandView.as_view(), name="warbands-template"),
    path(
        "warbands/<int:warband_id>/rarity-rolls/",
        WarbandRarityRollView.as_view(),
        name="warbands-rarity-rolls",
    ),
    path(
        "warbands/<int:warband_id>/beasts/recruit/",
        WarbandBeastRecruitView.as_view(),
        name="warbands-beasts-recruit",
    ),
    *unit_urlpatterns(HERO),
    *unit_urlpatterns(HENCHMEN_GROUP),
    *unit_urlpatterns(HIRELING),
    path(
        "warbands/<int:warband_id>/logs/",
        WarbandLogListView.as_view(),
        name="warbands-logs",
    ),
    path(
        "warbands/<int:warband_id>/resources/",
        WarbandResourceListCreateView.as_view(),
        name="warbands-resources",
    ),
    path(
        "warbands/<int:warband_id>/resources/<int:resource_id>/",
        WarbandResourceDetailView.as_view(),
        name="warbands-resources-detail",
    ),
    path(
        "warbands/<int:warband_id>/resources/<int:resource_id>/sell/",
        WarbandResourceSaleView.as_view(),
        name="warbands-resources-sell",
    ),
    path("warbands/<int:warband_id>/rules/", WarbandRuleListCreateView.as_view(), name="warbands-rules"),
    path(
        "warbands/<int:warband_id>/rules/from-template/",
        WarbandRuleFromTemplateView.as_view(),
        name="warbands-rules-from-template",
    ),
    path(
        "warbands/<int:warband_id>/rules/<int:rule_id>/",
        WarbandRuleDetailView.as_view(),
        name="warbands-rules-detail",
    ),
    path(
        "warbands/<int:warband_id>/trades/",
        WarbandTradeListCreateView.as_view(),
        name="warbands-trades",
    ),
    path(
        "warbands/<int:warband_id>/trades/<int:trade_id>/",
        WarbandTradeDetailView.as_view(),
        name="warbands-trades-detail",
    ),
]
