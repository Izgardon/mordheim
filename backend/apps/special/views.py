from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import (
    get_membership,
    get_writable_membership,
    has_campaign_permission,
    parse_campaign_id,
)
from apps.core.catalogue import merge
from apps.core.catalogue.duplicates import refusing_duplicates
from apps.core.catalogue.usage import delete_unless_in_use

from .models import Special
from .serializers import SpecialCreateSerializer, SpecialSerializer

DUPLICATE = "a special with this name and type"  # the base constraint (BUG-17)


class SpecialListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        specials = Special.objects.exclude(type="Pending")
        special_type = request.query_params.get("type")
        if special_type:
            specials = specials.filter(type__iexact=special_type.strip())
        search = request.query_params.get("search")
        if search:
            specials = specials.filter(name__icontains=search.strip())

        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))
        if campaign_id is not None:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            rows = merge.campaign_rows(specials, campaign_id).order_by(*merge.campaign_first("name", "id"))
            serializer = SpecialSerializer(rows, many=True)
            return Response(serializer.data)

        specials = specials.filter(campaign__isnull=True)
        serializer = SpecialSerializer(specials.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = parse_campaign_id(request.data.get("campaign_id"))
        membership = get_writable_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = SpecialCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        with refusing_duplicates(DUPLICATE):
            special = serializer.save()
        return Response(SpecialSerializer(special).data, status=status.HTTP_201_CREATED)


class SpecialDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)

        if special.campaign_id:
            membership = get_membership(request.user, special.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpecialSerializer(special).data)

    def patch(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)
        if not special.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_writable_membership(request.user, special.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "edit_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = SpecialCreateSerializer(special, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        with refusing_duplicates(DUPLICATE):
            serializer.save()
        return Response(SpecialSerializer(special).data)

    def delete(self, request, special_id):
        special = Special.objects.filter(id=special_id).first()
        if not special:
            return Response({"detail": "Not found"}, status=404)
        if not special.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_writable_membership(request.user, special.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "delete_catalogue"):
            return Response({"detail": "Forbidden"}, status=403)

        delete_unless_in_use(special, "special")  # 409 in_use when anything holds it (BUG-16)
        return Response(status=status.HTTP_204_NO_CONTENT)
