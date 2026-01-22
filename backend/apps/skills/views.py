from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Skill
from .serializers import SkillCreateSerializer, SkillSerializer


class SkillListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        skills = Skill.objects.all()
        skill_type = request.query_params.get("type")
        if skill_type:
            skills = skills.filter(type__iexact=skill_type.strip())
        search = request.query_params.get("search")
        if search:
            skills = skills.filter(name__icontains=search.strip())
        serializer = SkillSerializer(skills, many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_skills"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        serializer = SkillCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        skill = serializer.save(custom=True)
        return Response(SkillSerializer(skill).data, status=status.HTTP_201_CREATED)
