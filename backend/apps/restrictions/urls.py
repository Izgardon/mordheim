from django.urls import path

from .views import RestrictionListView

urlpatterns = [
    path("restrictions/", RestrictionListView.as_view(), name="restrictions"),
]
