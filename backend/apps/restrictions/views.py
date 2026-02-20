from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Restriction
from .serializers import RestrictionSerializer


class RestrictionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        restrictions = Restriction.objects.all()

        search = request.query_params.get("search")
        if search:
            restrictions = restrictions.filter(restriction__icontains=search.strip())

        restriction_type = request.query_params.get("type")
        if restriction_type:
            restrictions = restrictions.filter(type__iexact=restriction_type.strip())

        serializer = RestrictionSerializer(restrictions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RestrictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        restriction = serializer.save()
        return Response(
            RestrictionSerializer(restriction).data,
            status=status.HTTP_201_CREATED,
        )
