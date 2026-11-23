"""A campaign's location groups and locations (William, 23 Nov 2026): every member reads them while the Locations
page is on; `manage_locations` adds, edits and removes them. A visit is a warband's write (warbands/views/
location_visits.py)."""

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from ..serializers.locations import (
    CampaignLocationGroupSerializer,
    CampaignLocationSerializer,
    CampaignLocationWriteSerializer,
)
from ..services import locations
from .base import CampaignScopedView

FLAG = "enable_locations"
WRITE = "manage_locations"


class CampaignLocationGroupsView(CampaignScopedView):
    """GET: the groups in their order, each with its locations, their own tables and the tables they point to.
    POST: add a group, last."""

    feature_flag = FLAG
    rules = {"GET": "view", "POST": WRITE}

    def get(self, request, campaign_id):
        return Response(CampaignLocationGroupSerializer(locations.location_groups(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignLocationGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = locations.create_group(campaign_id, dict(serializer.validated_data))
        answer = CampaignLocationGroupSerializer(locations.location_groups(campaign_id).get(id=group.id)).data
        return Response(answer, status=status.HTTP_201_CREATED)


class CampaignLocationGroupDetailView(CampaignScopedView):
    """PATCH: its name, description and restrictions. DELETE: take it and its locations off the list."""

    feature_flag = FLAG
    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, group_id):
        group = self.group(campaign_id, group_id)
        serializer = CampaignLocationGroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        locations.update_group(group, dict(serializer.validated_data))
        return Response(CampaignLocationGroupSerializer(locations.location_groups(campaign_id).get(id=group.id)).data)

    def delete(self, request, campaign_id, group_id):
        locations.remove_group(self.group(campaign_id, group_id), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def group(self, campaign_id, group_id):
        found = locations.group_of(campaign_id, group_id)
        if found is None:
            raise NotFound("Not found")
        return found


class CampaignLocationsView(CampaignScopedView):
    """POST: add a location, last in its group, written whole with its own tables and the tables it points to."""

    feature_flag = FLAG
    rules = {"POST": WRITE}

    def post(self, request, campaign_id):
        serializer = CampaignLocationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        location = locations.create_location(campaign_id, dict(serializer.validated_data))
        answer = CampaignLocationSerializer(locations.location_of(campaign_id, location.id)).data
        return Response(answer, status=status.HTTP_201_CREATED)


class CampaignLocationDetailView(CampaignScopedView):
    """PATCH: the fields sent; `tables` and `chart_ids`, when sent, replace what it held. DELETE: take it off the
    list (a soft delete)."""

    feature_flag = FLAG
    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, location_id):
        location = self.location(campaign_id, location_id)
        serializer = CampaignLocationWriteSerializer(location, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        locations.update_location(location, dict(serializer.validated_data))
        return Response(CampaignLocationSerializer(locations.location_of(campaign_id, location.id)).data)

    def delete(self, request, campaign_id, location_id):
        locations.remove_location(self.location(campaign_id, location_id), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def location(self, campaign_id, location_id):
        found = locations.location_of(campaign_id, location_id)
        if found is None:
            raise NotFound("Not found")
        return found
