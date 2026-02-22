from django.urls import path

from .views import (
    CampaignTradeRequestAcceptView,
    CampaignTradeOfferAcceptView,
    CampaignTradeOfferUpdateView,
    CampaignTradeRequestCloseView,
    CampaignTradeRequestDeclineView,
    CampaignTradeRequestDetailView,
    CampaignTradeRequestListCreateView,
    UserPendingTradeRequestListView,
)

urlpatterns = [
    path(
        "trade-requests/pending/",
        UserPendingTradeRequestListView.as_view(),
        name="trade-requests-pending",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/",
        CampaignTradeRequestListCreateView.as_view(),
        name="campaigns-trade-requests",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/",
        CampaignTradeRequestDetailView.as_view(),
        name="campaigns-trade-requests-detail",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/accept/",
        CampaignTradeRequestAcceptView.as_view(),
        name="campaigns-trade-requests-accept",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/offer/",
        CampaignTradeOfferUpdateView.as_view(),
        name="campaigns-trade-requests-offer",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/lock/",
        CampaignTradeOfferAcceptView.as_view(),
        name="campaigns-trade-requests-lock",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/decline/",
        CampaignTradeRequestDeclineView.as_view(),
        name="campaigns-trade-requests-decline",
    ),
    path(
        "campaigns/<int:campaign_id>/trade-requests/<uuid:request_id>/close/",
        CampaignTradeRequestCloseView.as_view(),
        name="campaigns-trade-requests-close",
    ),
]
