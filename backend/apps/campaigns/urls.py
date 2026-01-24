from django.urls import path

from .views import (
    CampaignDetailView,
    CampaignHouseRuleDetailView,
    CampaignHouseRulesView,
    CampaignListCreateView,
    CampaignMemberPermissionsView,
    CampaignMemberRoleView,
    CampaignMembersView,
    CampaignMyPermissionsView,
    CampaignPermissionsView,
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
        "campaigns/<int:campaign_id>/members/<int:user_id>/permissions/",
        CampaignMemberPermissionsView.as_view(),
        name="campaigns-member-permissions",
    ),
    path(
        "campaigns/<int:campaign_id>/members/<int:user_id>/role/",
        CampaignMemberRoleView.as_view(),
        name="campaigns-member-role",
    ),
    path(
        "campaigns/<int:campaign_id>/permissions/",
        CampaignPermissionsView.as_view(),
        name="campaigns-permissions",
    ),
    path(
        "campaigns/<int:campaign_id>/permissions/me/",
        CampaignMyPermissionsView.as_view(),
        name="campaigns-my-permissions",
    ),
    path(
        "campaigns/<int:campaign_id>/rules/",
        CampaignHouseRulesView.as_view(),
        name="campaigns-house-rules",
    ),
    path(
        "campaigns/<int:campaign_id>/rules/<int:rule_id>/",
        CampaignHouseRuleDetailView.as_view(),
        name="campaigns-house-rules-detail",
    ),
]
