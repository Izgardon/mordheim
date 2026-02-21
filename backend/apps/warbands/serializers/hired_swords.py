from rest_framework import serializers

from apps.items.models import Item
from apps.special.models import Special
from apps.skills.models import Skill
from apps.spells.models import Spell

from apps.warbands.models import (
    HiredSword,
    HiredSwordItem,
    HiredSwordSkill,
    HiredSwordSpecial,
    HiredSwordSpell,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from .heroes import (
    ItemSummarySerializer,
    ItemDetailSerializer,
    SkillSummarySerializer,
    SkillDetailSerializer,
    SpecialSummarySerializer,
    SpecialDetailSerializer,
    SpellSummarySerializer,
    SpellDetailSerializer,
    RaceSummarySerializer,
    STAT_FIELDS,
    LARGE_SPECIAL_NAME,
    CASTER_SPECIAL_MAP,
    get_trait_specials,
    _sync_special_list,
    _sync_special_db,
)
from .utils import get_prefetched_or_query


class HiredSwordSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_items", "hired_sword_items")
        return [ItemSummarySerializer(entry.item).data for entry in links if entry.item_id]

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_skills", "hired_sword_skills")
        return [SkillSummarySerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_specials", "hired_sword_specials")
        return [SpecialSummarySerializer(entry.special).data for entry in links if entry.special_id]

    def get_spells(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_spells", "hired_sword_spells")
        return [SpellSummarySerializer(entry.spell).data for entry in links if entry.spell_id]

    class Meta:
        model = HiredSword
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "upkeep_price",
            "rating",
            "xp",
            "level_up",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HiredSwordDetailSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    race = RaceSummarySerializer(read_only=True)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_items", "hired_sword_items")
        return [ItemDetailSerializer(entry.item).data for entry in links if entry.item_id]

    def get_skills(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_skills", "hired_sword_skills")
        return [SkillDetailSerializer(entry.skill).data for entry in links if entry.skill_id]

    def get_specials(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_specials", "hired_sword_specials")
        return [SpecialDetailSerializer(entry.special).data for entry in links if entry.special_id]

    def get_spells(self, obj):
        links = get_prefetched_or_query(obj, "hired_sword_spells", "hired_sword_spells")
        return [SpellDetailSerializer(entry.spell).data for entry in links if entry.spell_id]

    class Meta:
        model = HiredSword
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "race",
            "price",
            "upkeep_price",
            "rating",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HiredSwordCreateSerializer(serializers.ModelSerializer):
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
    spell_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = HiredSword
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "upkeep_price",
            "rating",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "special_ids",
            "spell_ids",
        )

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
        special_ids = validated_data.pop("special_ids", [])
        spell_ids = validated_data.pop("spell_ids", [])

        traits = get_trait_specials()
        large_sp = traits.get(LARGE_SPECIAL_NAME)
        if large_sp:
            desired_large = validated_data.get("large", None)
            if desired_large is None:
                desired_large = large_sp.id in special_ids
                if desired_large:
                    validated_data["large"] = True
            _sync_special_list(special_ids, large_sp.id, desired_large)

        caster_value = validated_data.get("caster", "No")
        for caster_type, special_name in CASTER_SPECIAL_MAP.items():
            caster_sp = traits.get(special_name)
            if caster_sp:
                _sync_special_list(special_ids, caster_sp.id, caster_value == caster_type)

        if "level_up" not in validated_data:
            validated_data["level_up"] = 0

        hired_sword = HiredSword.objects.create(**validated_data)

        if item_ids:
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HiredSwordItem.objects.bulk_create(
                [
                    HiredSwordItem(hired_sword=hired_sword, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids:
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HiredSwordSkill.objects.bulk_create(
                [
                    HiredSwordSkill(hired_sword=hired_sword, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids:
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HiredSwordSpecial.objects.bulk_create(
                [
                    HiredSwordSpecial(hired_sword=hired_sword, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )
        if spell_ids:
            spells_by_id = {
                spell.id: spell for spell in Spell.objects.filter(id__in=spell_ids)
            }
            HiredSwordSpell.objects.bulk_create(
                [
                    HiredSwordSpell(hired_sword=hired_sword, spell=spells_by_id[spell_id])
                    for spell_id in spell_ids
                    if spell_id in spells_by_id
                ]
            )
        return hired_sword


class HiredSwordUpdateSerializer(serializers.ModelSerializer):
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
    spell_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = HiredSword
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "upkeep_price",
            "rating",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "caster",
            "available_skills",
            "half_rate",
            "blood_pacted",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
            "special_ids",
            "spell_ids",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        special_ids = validated_data.pop("special_ids", None)
        spell_ids = validated_data.pop("spell_ids", None)

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

        desired_caster = validated_data.get("caster", None)
        if special_ids is not None and desired_caster is not None:
            for caster_type, special_name in CASTER_SPECIAL_MAP.items():
                caster_sp = traits.get(special_name)
                if caster_sp:
                    _sync_special_list(special_ids, caster_sp.id, desired_caster == caster_type)

        previous_xp = instance.xp
        next_xp = validated_data.get("xp", instance.xp)
        should_increment_level = "xp" in validated_data and "level_up" not in validated_data

        hired_sword = super().update(instance, validated_data)

        if should_increment_level:
            settings = getattr(instance.warband.campaign, "settings", None)
            thresholds = settings.hired_sword_level_thresholds if settings else None
            new_level_ups = count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)
            if new_level_ups:
                hired_sword.level_up = (hired_sword.level_up or 0) + new_level_ups
                hired_sword.save(update_fields=["level_up"])

        if item_ids is not None:
            hired_sword.hired_sword_items.all().delete()
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HiredSwordItem.objects.bulk_create(
                [
                    HiredSwordItem(hired_sword=hired_sword, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids is not None:
            hired_sword.hired_sword_skills.all().delete()
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HiredSwordSkill.objects.bulk_create(
                [
                    HiredSwordSkill(hired_sword=hired_sword, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids is not None:
            hired_sword.hired_sword_specials.all().delete()
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HiredSwordSpecial.objects.bulk_create(
                [
                    HiredSwordSpecial(hired_sword=hired_sword, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )
        if special_ids is None:
            if large_sp and desired_large is not None:
                _sync_special_db(hired_sword, large_sp.id, desired_large)
            if desired_caster is not None:
                for caster_type, special_name in CASTER_SPECIAL_MAP.items():
                    caster_sp = traits.get(special_name)
                    if caster_sp:
                        _sync_special_db(hired_sword, caster_sp.id, desired_caster == caster_type)
        if large_sp and desired_large is not None and hired_sword.large != desired_large:
            hired_sword.large = desired_large
            hired_sword.save(update_fields=["large"])
        if spell_ids is not None:
            hired_sword.hired_sword_spells.all().delete()
            spells_by_id = {
                spell.id: spell for spell in Spell.objects.filter(id__in=spell_ids)
            }
            HiredSwordSpell.objects.bulk_create(
                [
                    HiredSwordSpell(hired_sword=hired_sword, spell=spells_by_id[spell_id])
                    for spell_id in spell_ids
                    if spell_id in spells_by_id
                ]
            )

        if hasattr(hired_sword, "_prefetched_objects_cache"):
            hired_sword._prefetched_objects_cache.pop("hired_sword_items", None)
            hired_sword._prefetched_objects_cache.pop("hired_sword_skills", None)
            hired_sword._prefetched_objects_cache.pop("hired_sword_specials", None)
            hired_sword._prefetched_objects_cache.pop("hired_sword_spells", None)
            hired_sword._prefetched_objects_cache.pop("skills", None)
            hired_sword._prefetched_objects_cache.pop("specials", None)
            hired_sword._prefetched_objects_cache.pop("spells", None)

        return hired_sword


class HiredSwordLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)
