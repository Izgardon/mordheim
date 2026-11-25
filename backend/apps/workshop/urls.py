from django.urls import path

from . import views

urlpatterns = [
    path("workshop/", views.WorkshopListView.as_view(), name="workshop"),
    path("workshop/warbands/", views.WarbandWorkshopView.as_view(), name="workshop-warbands"),
    path("workshop/lists/", views.ListWorkshopView.as_view(), name="workshop-lists"),
    path("workshop/import/", views.ImportIntoWorkshopView.as_view(), name="workshop-import"),
    path("workshop/shared/<str:code>/", views.SharedView.as_view(), name="workshop-shared"),
    path("workshop/<int:workshop_id>/", views.WorkshopDetailView.as_view(), name="workshop-detail"),
    path(
        "campaigns/<int:campaign_id>/warbands/import/",
        views.CampaignWarbandImportView.as_view(),
        name="campaign-warband-import",
    ),
    path(
        "campaigns/<int:campaign_id>/warband-templates/import/",
        views.CampaignListImportView.as_view(),
        name="campaign-list-import",
    ),
]
