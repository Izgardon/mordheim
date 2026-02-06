from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.logs.utils import log_warband_event
from apps.features.models import Feature
from apps.items.models import Item
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import Hero, HeroSkill, HeroSpell, HeroFeature
from apps.warbands.utils.trades import TradeHelper
from apps.warbands.permissions import CanEditWarband, CanViewWarband
from apps.warbands.serializers import (
    HeroCreateSerializer,
    HeroDetailSerializer,
    HeroLevelUpLogSerializer,
    HeroSummarySerializer,
    HeroUpdateSerializer,
    FeatureDetailSerializer,
    SpellDetailSerializer,
)
from apps.campaigns.permissions import get_membership

from .mixins import WarbandObjectMixin


class WarbandHeroListCreateView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        heroes = (
            Hero.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related("hero_items__item", "skills", "features", "spells")
            .order_by("id")
        )
        serializer = HeroSummarySerializer(heroes, many=True)
        return Response(serializer.data)

    def post(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        max_heroes = warband.campaign.max_heroes if warband.campaign else 6
        if max_heroes is None:
            max_heroes = 6

        if Hero.objects.filter(warband=warband).count() >= max_heroes:
            return Response(
                {"detail": f"Warband already has {max_heroes} heroes"}, status=400
            )

        serializer = HeroCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hero = serializer.save(warband=warband)
        log_warband_event(
            warband.id,
            "personnel",
            "new_hero",
            {"name": hero.name or "Unknown", "type": hero.unit_type or "Unknown"},
        )
        if hero.price and hero.price > 0:
            hero_label = hero.name or hero.unit_type or "Hero"
            TradeHelper.create_trade(
                warband=warband,
                action="Hire",
                description=f"Hired {hero_label}",
                price=hero.price,
                notes="",
            )
        return Response(HeroDetailSerializer(hero).data, status=status.HTTP_201_CREATED)


class WarbandHeroDetailListView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        heroes = (
            Hero.objects.filter(warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "skills",
                "features",
                "spells",
            )
            .order_by("id")
        )
        return Response(HeroDetailSerializer(heroes, many=True).data)


class WarbandHeroDetailView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)

        hero = (
            Hero.objects.filter(id=hero_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "skills",
                "features",
                "spells",
            )
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        return Response(HeroDetailSerializer(hero).data)

    def patch(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = (
            Hero.objects.filter(id=hero_id, warband=warband)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "skills",
                "features",
                "spells",
            )
            .first()
        )
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        old_skill_ids = set(hero.skills.values_list("id", flat=True))
        old_feature_ids = set(hero.features.values_list("id", flat=True))
        old_spell_ids = set(hero.spells.values_list("id", flat=True))
        old_item_ids = set(hero.items.values_list("id", flat=True))

        serializer = HeroUpdateSerializer(hero, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        hero_name = hero.name or hero.unit_type or "Unknown Hero"

        if "skill_ids" in request.data:
            new_skill_ids = set(request.data.get("skill_ids", []))
            added_skill_ids = new_skill_ids - old_skill_ids
            if added_skill_ids:
                from apps.skills.models import Skill
                added_skills = Skill.objects.filter(id__in=added_skill_ids)
                for skill in added_skills:
                    skill_type = skill.type or "general"
                    log_warband_event(
                        warband.id,
                        "loadout",
                        "hero",
                        {
                            "hero": hero_name,
                            "skill": skill.name,
                            "skill_type": skill_type,
                            "summary": f"{hero_name} learned the {skill_type} skill: {skill.name}",
                        },
                    )

        if "feature_ids" in request.data:
            new_feature_ids = set(request.data.get("feature_ids", []))
            added_feature_ids = new_feature_ids - old_feature_ids
            if added_feature_ids:
                added_features = Feature.objects.filter(id__in=added_feature_ids)
                for feature in added_features:
                    feature_type = feature.type or "ability"
                    log_warband_event(
                        warband.id,
                        "loadout",
                        "hero",
                        {
                            "hero": hero_name,
                            "feature": feature.name,
                            "feature_type": feature_type,
                            "summary": f"{hero_name} gained a {feature_type}: {feature.name}",
                        },
                    )

        if "spell_ids" in request.data:
            new_spell_ids = set(request.data.get("spell_ids", []))
            added_spell_ids = new_spell_ids - old_spell_ids
            if added_spell_ids:
                added_spells = Spell.objects.filter(id__in=added_spell_ids)
                for spell in added_spells:
                    spell_type = spell.type or "magic"
                    log_warband_event(
                        warband.id,
                        "loadout",
                        "hero",
                        {
                            "hero": hero_name,
                            "spell": spell.name,
                            "spell_type": spell_type,
                            "summary": f"{hero_name} attuned to the spell: {spell.name}",
                        },
                    )

        if "item_ids" in request.data:
            raw_item_ids = request.data.get("item_ids", [])
            item_reason = request.data.get("item_reason")
            item_action = request.data.get("item_action")
            action_text = str(item_action).strip().lower() if item_action is not None else ""
            is_acquired = action_text == "acquired"
            reason_text = str(item_reason).strip() if item_reason is not None else ""
            new_item_ids = set()
            if isinstance(raw_item_ids, (list, tuple)):
                for raw_id in raw_item_ids:
                    try:
                        new_item_ids.add(int(raw_id))
                    except (TypeError, ValueError):
                        continue
            else:
                try:
                    new_item_ids.add(int(raw_item_ids))
                except (TypeError, ValueError):
                    pass

            added_item_ids = new_item_ids - old_item_ids
            if added_item_ids:
                added_items = Item.objects.filter(id__in=added_item_ids)
                if is_acquired and not reason_text:
                    reason_text = "No reason given"
                for item in added_items:
                    if is_acquired:
                        summary = f"{hero_name} acquired: {item.name}."
                        payload = {
                            "hero": hero_name,
                            "item": item.name,
                            "reason": reason_text,
                            "summary": f"{summary} (Reason: {reason_text})",
                        }
                    else:
                        summary = f"{hero_name} gained a {item.name}"
                        payload = {
                            "hero": hero_name,
                            "item": item.name,
                            "summary": summary,
                        }
                        if reason_text:
                            summary = f"{summary} (Reason: {reason_text})"
                            payload["reason"] = reason_text
                            payload["summary"] = summary
                    log_warband_event(
                        warband.id,
                        "loadout",
                        "hero",
                        payload,
                    )

        return Response(HeroDetailSerializer(hero).data)

    def delete(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        hero_name = hero.name or "Unknown Hero"
        hero_type = hero.unit_type or "Unknown Type"
        log_warband_event(
            warband.id,
            "personnel",
            "remove_hero",
            {
                "name": hero_name,
                "type": hero_type,
                "summary": f"Dismissed {hero_name} the {hero_type}",
            },
        )
        hero.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandHeroLevelUpView(WarbandObjectMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]

    STAT_MAP = {
        "M": "movement",
        "WS": "weapon_skill",
        "BS": "ballistic_skill",
        "S": "strength",
        "T": "toughness",
        "W": "wounds",
        "I": "initiative",
        "A": "attacks",
        "Ld": "leadership",
    }

    def post(self, request, warband_id, hero_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        if not CanViewWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Not found"}, status=404)
        if not CanEditWarband().has_object_permission(request, self, warband):
            return Response({"detail": "Forbidden"}, status=403)

        hero = Hero.objects.filter(id=hero_id, warband=warband).first()
        if not hero:
            return Response({"detail": "Not found"}, status=404)

        serializer = HeroLevelUpLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data.get("payload") or {}

        current_level_ups = hero.level_up or 0
        if current_level_ups <= 0:
            return Response({"detail": "No level ups available"}, status=400)

        advance = payload.get("advance", {})
        advance_id = advance.get("id") if isinstance(advance, dict) else None

        update_fields = ["level_up"]

        if advance_id in self.STAT_MAP:
            stat_field = self.STAT_MAP[advance_id]
            current_value = getattr(hero, stat_field, 0) or 0
            new_value = min(10, current_value + 1)
            setattr(hero, stat_field, new_value)
            update_fields.append(stat_field)
        elif advance_id == "Skill":
            new_skill = Skill.objects.filter(
                campaign__isnull=True, name="New Skill", type="Pending"
            ).first()
            if new_skill:
                HeroSkill.objects.get_or_create(hero=hero, skill=new_skill)
        elif advance_id == "Spell":
            new_spell = Spell.objects.filter(
                campaign__isnull=True, name="New Spell", type="Pending"
            ).first()
            if new_spell:
                HeroSpell.objects.get_or_create(hero=hero, spell=new_spell)
        elif advance_id == "Feature":
            new_feature = Feature.objects.filter(
                campaign__isnull=True, name="New Feature", type="Pending"
            ).first()
            if new_feature:
                HeroFeature.objects.get_or_create(hero=hero, feature=new_feature)

        hero.level_up = max(0, current_level_ups - 1)
        hero.save(update_fields=update_fields)

        log_warband_event(warband.id, "advance", "hero", payload)

        hero.refresh_from_db()
        hero = (
            Hero.objects.filter(id=hero_id)
            .select_related("race")
            .prefetch_related(
                "hero_items__item__property_links__property",
                "skills",
                "features",
                "spells",
            )
            .first()
        )

        return Response(HeroDetailSerializer(hero).data)


class HeroFeatureDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, feature_id):
        feature = Feature.objects.filter(id=feature_id).first()
        if not feature:
            return Response({"detail": "Not found"}, status=404)

        if feature.campaign_id:
            membership = get_membership(request.user, feature.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(FeatureDetailSerializer(feature).data)


class HeroSpellDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, spell_id):
        spell = Spell.objects.filter(id=spell_id).first()
        if not spell:
            return Response({"detail": "Not found"}, status=404)

        if spell.campaign_id:
            membership = get_membership(request.user, spell.campaign_id)
            if not membership:
                return Response({"detail": "Not found"}, status=404)

        return Response(SpellDetailSerializer(spell).data)
