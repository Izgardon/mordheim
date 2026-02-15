from rest_framework import serializers

from apps.items.models import Item, ItemPropertyLink
from apps.special.models import Special
from apps.skills.models import Skill
from apps.spells.models import Spell

from apps.warbands.models import Hero, HeroSpecial, HeroItem, HeroSkill, HeroSpell
from apps.warbands.utils.hero_level import count_new_level_ups
from .utils import get_prefetched_or_query

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
    "armour_save",
)

LARGE_SPECIAL_NAME = "Large"
CASTER_SPECIAL_MAP = {"Wizard": "Wizard", "Priest": "Priest"}
TRAIT_SPECIAL_NAMES = [LARGE_SPECIAL_NAME, *CASTER_SPECIAL_MAP.values()]


def get_trait_specials():
    return {s.name: s for s in Special.objects.filter(name__in=TRAIT_SPECIAL_NAMES)}


def _sync_special_list(special_ids, special_id, should_have):
    if should_have:
        if special_id not in special_ids:
            special_ids.append(special_id)
        return
    while special_id in special_ids:
        special_ids.remove(special_id)


def _sync_special_db(hero, special_id, should_have):
    if should_have:
        if not HeroSpecial.objects.filter(hero=hero, special_id=special_id).exists():
            HeroSpecial.objects.create(hero=hero, special_id=special_id)
    else:
        HeroSpecial.objects.filter(hero=hero, special_id=special_id).delete()


class ItemPropertySummarySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="property.id")
    name = serializers.CharField(source="property.name")

    class Meta:
        model = ItemPropertyLink
        fields = ("id", "name")


class ItemSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ("id", "name", "cost")


class ItemDetailSerializer(serializers.ModelSerializer):
    properties = serializers.SerializerMethodField()
    save = serializers.CharField(source="save_value", allow_null=True, required=False)

    def get_properties(self, obj):
        links = getattr(obj, "property_links", None)
        if links is None:
            return []
        return ItemPropertySummarySerializer(links.all(), many=True).data

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "subtype",
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "single_use",
            "strength",
            "range",
            "save",
            "statblock",
            "properties",
        )


class SkillSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")


class SkillDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name", "type")


class SpecialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name")


class SpecialDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("id", "name", "type", "description")


class SpellSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Spell
        fields = ("id", "name")


class SpellDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spell
        fields = ("id", "name", "type", "dc", "description")


class RaceSummarySerializer(serializers.Serializer):
    name = serializers.CharField()
    movement = serializers.IntegerField()
    weapon_skill = serializers.IntegerField()
    ballistic_skill = serializers.IntegerField()
    strength = serializers.IntegerField()
    toughness = serializers.IntegerField()
    wounds = serializers.IntegerField()
    initiative = serializers.IntegerField()
    attacks = serializers.IntegerField()
    leadership = serializers.IntegerField()


class HeroSummarySerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        return [ItemSummarySerializer(entry.item).data for entry in hero_items if entry.item_id]

    def get_skills(self, obj):
        hero_skills = get_prefetched_or_query(obj, "hero_skills", "hero_skills")
        return [SkillSummarySerializer(entry.skill).data for entry in hero_skills if entry.skill_id]

    def get_specials(self, obj):
        hero_specials = get_prefetched_or_query(obj, "hero_specials", "hero_specials")
        return [SpecialSummarySerializer(entry.special).data for entry in hero_specials if entry.special_id]

    def get_spells(self, obj):
        hero_spells = get_prefetched_or_query(obj, "hero_spells", "hero_spells")
        return [SpellSummarySerializer(entry.spell).data for entry in hero_spells if entry.spell_id]

    class Meta:
        model = Hero
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "xp",
            "level_up",
            "level_up_history",
            "large",
            "caster",
            "half_rate",
            "available_skills",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HeroDetailSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    race = RaceSummarySerializer(read_only=True)
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, read_only=True, coerce_to_string=False)
    items = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    specials = serializers.SerializerMethodField()
    spells = serializers.SerializerMethodField()

    def get_items(self, obj):
        hero_items = get_prefetched_or_query(obj, "hero_items", "hero_items")
        return [ItemDetailSerializer(entry.item).data for entry in hero_items if entry.item_id]

    def get_skills(self, obj):
        hero_skills = get_prefetched_or_query(obj, "hero_skills", "hero_skills")
        return [SkillDetailSerializer(entry.skill).data for entry in hero_skills if entry.skill_id]

    def get_specials(self, obj):
        hero_specials = get_prefetched_or_query(obj, "hero_specials", "hero_specials")
        return [SpecialDetailSerializer(entry.special).data for entry in hero_specials if entry.special_id]

    def get_spells(self, obj):
        hero_spells = get_prefetched_or_query(obj, "hero_spells", "hero_spells")
        return [SpellDetailSerializer(entry.spell).data for entry in hero_spells if entry.spell_id]

    class Meta:
        model = Hero
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
            "kills",
            "level_up",
            "level_up_history",
            "deeds",
            "large",
            "caster",
            "half_rate",
            "dead",
            "available_skills",
            *STAT_FIELDS,
            "items",
            "skills",
            "specials",
            "spells",
        )


class HeroCreateSerializer(serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
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
        model = Hero
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "large",
            "caster",
            "half_rate",
            "dead",
            "available_skills",
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
        hero = Hero.objects.create(**validated_data)
        if item_ids:
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids:
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HeroSkill.objects.bulk_create(
                [
                    HeroSkill(hero=hero, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids:
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HeroSpecial.objects.bulk_create(
                [
                    HeroSpecial(hero=hero, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )
        if spell_ids:
            spells_by_id = {
                spell.id: spell for spell in Spell.objects.filter(id__in=spell_ids)
            }
            HeroSpell.objects.bulk_create(
                [
                    HeroSpell(hero=hero, spell=spells_by_id[spell_id])
                    for spell_id in spell_ids
                    if spell_id in spells_by_id
                ]
            )
        return hero


class HeroUpdateSerializer(serializers.ModelSerializer):
    xp = serializers.DecimalField(max_digits=6, decimal_places=1, required=False, coerce_to_string=False)
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    item_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_action = serializers.CharField(write_only=True, required=False, allow_blank=True)
    item_price = serializers.FloatField(write_only=True, required=False)
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
        model = Hero
        fields = (
            "name",
            "unit_type",
            "race",
            "price",
            "xp",
            "kills",
            "level_up",
            "deeds",
            "large",
            "caster",
            "half_rate",
            "dead",
            "available_skills",
            *STAT_FIELDS,
            "item_ids",
            "item_reason",
            "item_action",
            "item_price",
            "skill_ids",
            "special_ids",
            "spell_ids",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        validated_data.pop("item_reason", None)
        validated_data.pop("item_action", None)
        validated_data.pop("item_price", None)
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
        hero = super().update(instance, validated_data)
        if should_increment_level:
            new_level_ups = count_new_level_ups(previous_xp, next_xp)
            if new_level_ups:
                hero.level_up = (hero.level_up or 0) + new_level_ups
                hero.save(update_fields=["level_up"])
        if item_ids is not None:
            hero.hero_items.all().delete()
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids is not None:
            hero.hero_skills.all().delete()
            skills_by_id = {
                skill.id: skill for skill in Skill.objects.filter(id__in=skill_ids)
            }
            HeroSkill.objects.bulk_create(
                [
                    HeroSkill(hero=hero, skill=skills_by_id[skill_id])
                    for skill_id in skill_ids
                    if skill_id in skills_by_id
                ]
            )
        if special_ids is not None:
            hero.hero_specials.all().delete()
            specials_by_id = {
                special.id: special for special in Special.objects.filter(id__in=special_ids)
            }
            HeroSpecial.objects.bulk_create(
                [
                    HeroSpecial(hero=hero, special=specials_by_id[special_id])
                    for special_id in special_ids
                    if special_id in specials_by_id
                ]
            )
        if special_ids is None:
            if large_sp and desired_large is not None:
                _sync_special_db(hero, large_sp.id, desired_large)
            if desired_caster is not None:
                for caster_type, special_name in CASTER_SPECIAL_MAP.items():
                    caster_sp = traits.get(special_name)
                    if caster_sp:
                        _sync_special_db(hero, caster_sp.id, desired_caster == caster_type)
        if large_sp and desired_large is not None and hero.large != desired_large:
            hero.large = desired_large
            hero.save(update_fields=["large"])
        if spell_ids is not None:
            hero.hero_spells.all().delete()
            spells_by_id = {
                spell.id: spell for spell in Spell.objects.filter(id__in=spell_ids)
            }
            HeroSpell.objects.bulk_create(
                [
                    HeroSpell(hero=hero, spell=spells_by_id[spell_id])
                    for spell_id in spell_ids
                    if spell_id in spells_by_id
                ]
            )
        if hasattr(hero, "_prefetched_objects_cache"):
            hero._prefetched_objects_cache.pop("hero_items", None)
            hero._prefetched_objects_cache.pop("hero_skills", None)
            hero._prefetched_objects_cache.pop("hero_specials", None)
            hero._prefetched_objects_cache.pop("hero_spells", None)
            hero._prefetched_objects_cache.pop("skills", None)
            hero._prefetched_objects_cache.pop("specials", None)
            hero._prefetched_objects_cache.pop("spells", None)
        return hero


class HeroLevelUpLogSerializer(serializers.Serializer):
    payload = serializers.JSONField(required=False)
