from typing import Any

from rest_framework import serializers

from apps.skills.models import Skill
from apps.special.models import Special
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups

from .heroes import (
    LARGE_SPECIAL_NAME,
    STAT_FIELDS,
    ItemDetailSerializer,
    ItemSummarySerializer,
    RaceSummarySerializer,
    SkillDetailSerializer,
    SkillSummarySerializer,
    SpecialDetailSerializer,
    SpecialSummarySerializer,
    _build_item_join_rows,
    _sync_special_db,
    _sync_special_list,
    get_trait_specials,
)
from .utils import get_prefetched_or_query


class HenchmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead")


class HenchmanEntrySerializer(serializers.ModelSerializer):
    """One member entry in a group create or PATCH.

    Bad values are a 400 here instead of a database error (BUG-90), and ids come out as ints, so
    "12" names the same member as 12 (BUG-93). `cost` and `item_notes` are passed through as sent;
    the view parses them for the recruit trade.
    """

    id = serializers.IntegerField(required=False, allow_null=True)
    cost = serializers.JSONField(required=False, allow_null=True)
    item_notes = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Henchman
        fields = ("id", "name", "kills", "dead", "cost", "item_notes")
        extra_kwargs = {"name": {"required": False, "allow_blank": True, "trim_whitespace": False}}


class HenchmenGroupSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    henchmen = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_items", "henchmen_group_items")
        return [ItemSummarySerializer(entry).data for entry in links if entry.item_id]

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
            "large",
            "half_rate",
            "no_level_ups",
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
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    henchmen = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "henchmen_group_items", "henchmen_group_items")
        items = []
        for entry in links:
            if not entry.item_id:
                continue
            data = ItemDetailSerializer(entry.item).data
            data["cost"] = getattr(entry, "cost", None)
            items.append(data)
        return items

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
            "deeds",
            "large",
            "half_rate",
            "no_level_ups",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "henchmen",
        )


class HenchmenGroupCreateSerializer(serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(
        child=serializers.DictField(),
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
        child=HenchmanEntrySerializer(),
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
            "no_level_ups",
            "dead",
            *STAT_FIELDS,
            "items",
            "skill_ids",
            "special_ids",
            "henchmen",
        )

    def validate_henchmen(self, value):
        if not value:
            raise serializers.ValidationError("At least one henchman is required.")
        return value

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
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

        # Seeded XP on first persist should not generate queued level-ups.
        validated_data["level_up"] = 0

        group = HenchmenGroup.objects.create(**validated_data)

        if items_data:
            HenchmenGroupItem.objects.bulk_create(
                _build_item_join_rows(HenchmenGroupItem, "henchmen_group", group, items_data)
            )
        if skill_ids:
            skills_by_id = {skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)}
            HenchmenGroupSkill.objects.bulk_create(
                [
                    HenchmenGroupSkill(henchmen_group=group, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids:
            specials_by_id = {special.id: special for special in Special.objects.filter(id__in=special_ids)}
            HenchmenGroupSpecial.objects.bulk_create(
                [
                    HenchmenGroupSpecial(henchmen_group=group, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )

        Henchman.objects.bulk_create([Henchman(group=group, name=entry.get("name", "")) for entry in henchmen_data])

        return group


MEMBER_FIELDS = ("name", "kills", "dead")


def _sync_members(group: HenchmenGroup, entries: list[dict[str, Any]]) -> None:
    """Apply a PATCH's member list to `group`.

    An entry naming a living member updates only the fields it carries (BUG-94); an entry without a
    known id is a new member. Living members left out of the list are removed. Dead members are
    records (BUG-04): this path never edits, duplicates (BUG-92) or deletes them, however the caller
    loaded the group, so an entry naming one is ignored.
    """
    members = dict(Henchman.objects.filter(group=group).values_list("id", "dead"))
    living_ids = {member_id for member_id, dead in members.items() if not dead}
    kept_ids: set[int] = set()
    to_create = []
    for entry in entries:
        member_id = entry.get("id")
        if member_id in members:
            if member_id in living_ids:
                kept_ids.add(member_id)
                fields = {name: entry[name] for name in MEMBER_FIELDS if name in entry}
                if fields:
                    Henchman.objects.filter(id=member_id).update(**fields)
            continue
        to_create.append(
            Henchman(
                group=group,
                name=entry.get("name", ""),
                kills=entry.get("kills", 0),
                dead=entry.get("dead", False),
            )
        )
    removed_ids = living_ids - kept_ids
    if removed_ids:
        Henchman.objects.filter(group=group, id__in=removed_ids, dead=False).delete()
    if to_create:
        Henchman.objects.bulk_create(to_create)


class HenchmenGroupUpdateSerializer(serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    items = serializers.ListField(
        child=serializers.DictField(),
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
        child=HenchmanEntrySerializer(),
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
            "no_level_ups",
            "dead",
            *STAT_FIELDS,
            "items",
            "skill_ids",
            "special_ids",
            "henchmen",
        )

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
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

        if should_increment_level and not group.no_level_ups:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.henchmen_level_thresholds if settings else None
            new_level_ups = count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                group.level_up = (group.level_up or 0) + new_level_ups
                group.save(update_fields=["level_up"])

        if items_data is not None:
            group.henchmen_group_items.all().delete()
            HenchmenGroupItem.objects.bulk_create(
                _build_item_join_rows(HenchmenGroupItem, "henchmen_group", group, items_data)
            )
        if skill_ids is not None:
            group.henchmen_group_skills.all().delete()
            skills_by_id = {skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)}
            HenchmenGroupSkill.objects.bulk_create(
                [
                    HenchmenGroupSkill(henchmen_group=group, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids is not None:
            group.henchmen_group_specials.all().delete()
            specials_by_id = {special.id: special for special in Special.objects.filter(id__in=special_ids)}
            HenchmenGroupSpecial.objects.bulk_create(
                [
                    HenchmenGroupSpecial(henchmen_group=group, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )

        if special_ids is None:
            if large_sp and desired_large is not None:
                _sync_special_db(group.henchmen_group_specials, large_sp.id, desired_large)
        if large_sp and desired_large is not None and group.large != desired_large:
            group.large = desired_large
            group.save(update_fields=["large"])

        if henchmen_data is not None:
            _sync_members(group, henchmen_data)

        if hasattr(group, "_prefetched_objects_cache"):
            group._prefetched_objects_cache.pop("henchmen_group_items", None)
            group._prefetched_objects_cache.pop("henchmen_group_skills", None)
            group._prefetched_objects_cache.pop("henchmen_group_specials", None)
            group._prefetched_objects_cache.pop("henchmen", None)

        return group


class HenchmenLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.DictField(required=False)  # a non-object payload is a 400, not a 500 (BUG-89)
