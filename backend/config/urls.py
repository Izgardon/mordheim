from django.urls import include, path

urlpatterns = [
    path("api/", include("apps.core.urls")),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.realtime.urls")),
    path("api/", include("apps.trades.urls")),
    path("api/", include("apps.campaigns.urls")),
    path("api/", include("apps.items.urls")),
    path("api/", include("apps.races.urls")),
    path("api/", include("apps.skills.urls")),
    path("api/", include("apps.spells.urls")),
    path("api/", include("apps.special.urls")),
    path("api/", include("apps.warbands.urls")),
]

