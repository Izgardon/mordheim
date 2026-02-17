from rest_framework import serializers

from apps.items.models import Item
from apps.special.models import Special
from apps.skills.models import Skill

from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from .heroes import (
    ItemSummarySerializer,
    ItemDetailSerializer,
    SkillSummarySerializer,
    SkillDetailSerializer,
    SpecialSummarySerializer,
    SpecialDetailSerializer,
    RaceSummarySerializer,
    STAT_FIELDS,
    LARGE_SPECIAL_NAME,
    get_trait_specials,
    _sync_special_list,
    _sync_special_db,
)
from .utils import get_prefetched_or_query


class HenchmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead")


class HenchmenGroupSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    henchmen = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_items", "henchmen_group_items")
        return [ItemSummarySerializer(entry.item).data for entry in links if entry.item_id]

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_skills", "henchmen_group_skills")
        return [SkillSummarySerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_specials", "henchmen_group_specials")
        return [SpecialSummarySerializer(entry.special).data for entry in links if entry.special_id]

    def get_henchmen(self, obj):
        members = get_prefetched_or_query(obj, "henchmen", "henchmen")
        return HenchmanSerializer(members, many=True).data

    class Meta:
        model = HenchmenGroup
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "xp",
            "max_size",
            "level_up",
            "level_up_history",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "henchmen",
        )


class HenchmenGroupDetailSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    race = RaceSummarySerializer(read_only=True)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    henchmen = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_items", "henchmen_group_items")
        return [ItemDetailSerializer(entry.item).data for entry in links if entry.item_id]

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_skills", "henchmen_group_skills")
        return [SkillDetailSerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_specials", "henchmen_group_specials")
        return [SpecialDetailSerializer(entry.special).data for entry in links if entry.special_id]

    def get_henchmen(self, obj):
        members = get_prefetched_or_query(obj, "henchmen", "henchmen")
        return HenchmanSerializer(members, many=True).data

    class Meta:
        model = HenchmenGroup
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "race",
            "price",
            "xp",
            "max_size",
            "level_up",
            "level_up_history",
            "deeds",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "henchmen",
        )


class HenchmenGroupCreateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    special_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    henchmen = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = HenchmenGroup
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "xp",
            "max_size",
            "level_up",
            "deeds",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "special_ids",
            "henchmen",
        )

    def validate_henchmen(self, value):
        if not value:
            raise serializers.ValidationError("At least one henchman is required.")
        return value

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
        special_ids = validated_data.pop("special_ids", [])
        henchmen_data = validated_data.pop("henchmen", [])

        traits = get_trait_specials()
        large_sp = traits.get(LARGE_SPECIAL_NAME)
        if large_sp:
            desired_large = validated_data.get("large", None)
            if desired_large is None:
                desired_large = large_sp.id in special_ids
                if desired_large:
                    validated_data["large"] = True
            _sync_special_list(special_ids, large_sp.id, desired_large)

        if "level_up" not in validated_data:
            validated_data["level_up"] = 0

        group = HenchmenGroup.objects.create(**validated_data)

        if item_ids:
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HenchmenGroupItem.objects.bulk_create(
                [
                    HenchmenGroupItem(henchmen_group=group, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids:
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HenchmenGroupSkill.objects.bulk_create(
                [
                    HenchmenGroupSkill(henchmen_group=group, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids:
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HenchmenGroupSpecial.objects.bulk_create(
                [
                    HenchmenGroupSpecial(henchmen_group=group, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )

        Henchman.objects.bulk_create(
            [
                Henchman(group=group, name=entry.get("name", ""))
                for entry in henchmen_data
            ]
        )

        return group


class HenchmenGroupUpdateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    special_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    henchmen = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = HenchmenGroup
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "xp",
            "max_size",
            "level_up",
            "deeds",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "special_ids",
            "henchmen",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        special_ids = validated_data.pop("special_ids", None)
        henchmen_data = validated_data.pop("henchmen", None)

        traits = get_trait_specials()
        large_sp = traits.get(LARGE_SPECIAL_NAME)
        desired_large = validated_data.get("large", None)
        if large_sp:
            if special_ids is not None:
                if desired_large is None:
                    desired_large = large_sp.id in special_ids
                    validated_data["large"] = desired_large
                else:
                    _sync_special_list(special_ids, large_sp.id, desired_large)
            elif desired_large is not None:
                desired_large = bool(desired_large)

        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data

        group = super().update(instance, validated_data)

        if should_increment_level:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.henchmen_level_thresholds if settings else None
            new_level_ups = count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                group.level_up = (group.level_up or 0) + new_level_ups
                group.save(update_fields=["level_up"])

        if item_ids is not None:
            group.henchmen_group_items.all().delete()
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HenchmenGroupItem.objects.bulk_create(
                [
                    HenchmenGroupItem(henchmen_group=group, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids is not None:
            group.henchmen_group_skills.all().delete()
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HenchmenGroupSkill.objects.bulk_create(
                [
                    HenchmenGroupSkill(henchmen_group=group, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids is not None:
            group.henchmen_group_specials.all().delete()
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HenchmenGroupSpecial.objects.bulk_create(
                [
                    HenchmenGroupSpecial(henchmen_group=group, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )

        if special_ids is None:
            if large_sp and desired_large is not None:
                _sync_special_db(group, large_sp.id, desired_large)
        if large_sp and desired_large is not None and group.large != desired_large:
            group.large = desired_large
            group.save(update_fields=["large"])

        if henchmen_data is not None:
            existing_ids = set(group.henchmen.values_list("id", flat=True))
            incoming_ids = set()
            to_create = []
            for entry in henchmen_data:
                henchman_id = entry.get("id")
                if henchman_id and henchman_id in existing_ids:
                    incoming_ids.add(henchman_id)
                    Henchman.objects.filter(id=henchman_id, group=group).update(
                        name=entry.get("name", ""),
                        kills=entry.get("kills", 0),
                        dead=entry.get("dead", False),
                    )
                else:
                    to_create.append(
                        Henchman(
                            group=group,
                            name=entry.get("name", ""),
                            kills=entry.get("kills", 0),
                            dead=entry.get("dead", False),
                        )
                    )
            ids_to_delete = existing_ids - incoming_ids
            if ids_to_delete:
                Henchman.objects.filter(id__in=ids_to_delete, group=group).delete()
            if to_create:
                Henchman.objects.bulk_create(to_create)

        if hasattr(group, "_prefetched_objects_cache"):
            group._prefetched_objects_cache.pop("henchmen_group_items", None)
            group._prefetched_objects_cache.pop("henchmen_group_skills", None)
            group._prefetched_objects_cache.pop("henchmen_group_specials", None)
            group._prefetched_objects_cache.pop("henchmen", None)

        return group


class HenchmenLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)
