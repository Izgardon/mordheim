from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import Campaign
from apps.campaigns.permissions import get_membership, has_campaign_permission

from .models import Skill
from .serializers import SkillCreateSerializer, SkillSerializer


class SkillListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        skills = Skill.objects.exclude(type="Hidden")
        skill_type = request.query_params.get("type")
        if skill_type:
            skills = skills.filter(type__iexact=skill_type.strip())
        search = request.query_params.get("search")
        if search:
            skills = skills.filter(name__icontains=search.strip())

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            membership = get_membership(request.user, campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

            campaign = (
                Campaign.objects.select_related("campaign_type")
                .filter(id=campaign_id)
                .first()
            )
            if not campaign:
                return Response({"detail": "Not found"}, status=404)

            campaign_skills = skills.filter(campaign_id=campaign_id)
            base_skills = skills.filter(
                campaign__isnull=True,
                campaign_types__campaign_type=campaign.campaign_type,
            )
            if campaign_skills.exists():
                base_skills = base_skills.exclude(
                    name__in=campaign_skills.values_list("name", flat=True)
                )
            merged = list(campaign_skills.order_by("name", "id")) + list(
                base_skills.order_by("name", "id")
            )
            serializer = SkillSerializer(merged, many=True)
            return Response(serializer.data)

        skills = skills.filter(campaign__isnull=True)
        serializer = SkillSerializer(skills.order_by("name", "id"), many=True)
        return Response(serializer.data)

    def post(self, request):
        campaign_id = request.data.get("campaign_id")
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "add_skills"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data["campaign"] = campaign_id
        serializer = SkillCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        skill = serializer.save()
        return Response(SkillSerializer(skill).data, status=status.HTTP_201_CREATED)


class SkillDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, skill_id):
        skill = Skill.objects.filter(id=skill_id).first()
        if not skill:
            return Response({"detail": "Not found"}, status=404)

        if skill.campaign_id:
            membership = get_membership(request.user, skill.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SkillSerializer(skill).data)

    def patch(self, request, skill_id):
        skill = Skill.objects.filter(id=skill_id).first()
        if not skill:
            return Response({"detail": "Not found"}, status=404)
        if not skill.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, skill.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_skills"):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data.pop("campaign_id", None)
        data.pop("campaign", None)
        serializer = SkillCreateSerializer(skill, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SkillSerializer(skill).data)

    def delete(self, request, skill_id):
        skill = Skill.objects.filter(id=skill_id).first()
        if not skill:
            return Response({"detail": "Not found"}, status=404)
        if not skill.campaign_id:
            return Response({"detail": "Forbidden"}, status=403)

        membership = get_membership(request.user, skill.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)
        if not has_campaign_permission(membership, "manage_skills"):
            return Response({"detail": "Forbidden"}, status=403)

        skill.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
