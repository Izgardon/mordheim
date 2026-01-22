from django.urls import path

from .views import (
    CampaignAdminPermissionsView,
    CampaignDetailView,
    CampaignListCreateView,
    CampaignMembersView,
    CampaignPlayersView,
    JoinCampaignView,
)

urlpatterns = [
    path("campaigns/", CampaignListCreateView.as_view(), name="campaigns"),
    path("campaigns/join/", JoinCampaignView.as_view(), name="campaigns-join"),
    path("campaigns/<int:campaign_id>/", CampaignDetailView.as_view(), name="campaigns-detail"),
    path(
        "campaigns/<int:campaign_id>/players/",
        CampaignPlayersView.as_view(),
        name="campaigns-players",
    ),
    path(
        "campaigns/<int:campaign_id>/members/",
        CampaignMembersView.as_view(),
        name="campaigns-members",
    ),
    path(
        "campaigns/<int:campaign_id>/permissions/admin/",
        CampaignAdminPermissionsView.as_view(),
        name="campaigns-admin-permissions",
    ),
]
