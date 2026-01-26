import random
import string

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignPermission,
    CampaignRole,
    CampaignType,
)

ROLE_SEED = [
    ("owner", "Owner"),
    ("admin", "Admin"),
    ("player", "Player"),
]

PERMISSION_SEED = [
    ("add_items", "Add items"),
    ("add_skills", "Add skills"),
    ("manage_items", "Manage items"),
    ("manage_skills", "Manage skills"),
    ("manage_rules", "Manage rules"),
    ("manage_warbands", "Manage warbands"),
    ("manage_locations", "Manage locations"),
]

def _ensure_roles():
    roles = {}
    for slug, name in ROLE_SEED:
        role, _ = CampaignRole.objects.get_or_create(slug=slug, defaults={"name": name})
        roles[slug] = role
    return roles


def _ensure_permissions():
    permissions = {}
    for code, name in PERMISSION_SEED:
        permission, _ = CampaignPermission.objects.get_or_create(
            code=code, defaults={"name": name}
        )
        permissions[code] = permission
    return permissions


def _ensure_campaign_type(code):
    cleaned = str(code or "").strip().lower() or "standard"
    name = cleaned.replace("_", " ").title()
    campaign_type, _ = CampaignType.objects.get_or_create(
        code=cleaned, defaults={"name": name}
    )
    return campaign_type


def _generate_join_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def _unique_join_code():
    for _ in range(20):
        code = _generate_join_code()
        if not Campaign.objects.filter(join_code=code).exists():
            return code
    return _generate_join_code()


class Command(BaseCommand):
    help = "Seed a campaign with users and memberships."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=8,
            help="Number of users to create.",
        )
        parser.add_argument(
            "--admins",
            type=int,
            default=1,
            help="Number of admin users to create (in addition to the owner).",
        )
        parser.add_argument(
            "--campaign-name",
            default="Shards of the Comet",
            help="Campaign name to create or reuse.",
        )
        parser.add_argument(
            "--campaign-type",
            default="standard",
            help="Campaign type code to use.",
        )
        parser.add_argument(
            "--max-players",
            type=int,
            default=None,
            help="Max player count for the campaign.",
        )
        parser.add_argument(
            "--email-domain",
            default="wyrdstone.dev",
            help="Domain used for seeded email addresses.",
        )
        parser.add_argument(
            "--prefix",
            default="raider",
            help="Prefix used for seeded email addresses.",
        )
        parser.add_argument(
            "--password",
            default="wyrdstone123",
            help="Password applied to newly created users.",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset passwords for existing seeded users.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        count = options["count"]
        admin_count = options["admins"]
        campaign_name = options["campaign_name"]
        campaign_type_code = options["campaign_type"]
        max_players = options["max_players"]
        email_domain = options["email_domain"]
        prefix = options["prefix"]
        password = options["password"]
        reset_passwords = options["reset_passwords"]

        if count < 1:
            raise CommandError("--count must be at least 1 to create an owner.")

        admin_count = max(0, min(admin_count, count - 1))
        desired_max_players = max_players if max_players is not None else max(count + 1, 6)
        desired_max_players = max(desired_max_players, count + 1)

        campaign_type = _ensure_campaign_type(campaign_type_code)

        campaign = Campaign.objects.filter(
            name=campaign_name, campaign_type=campaign_type
        ).first()
        campaign_created = False

        if not campaign:
            campaign = Campaign.objects.create(
                name=campaign_name,
                campaign_type=campaign_type,
                join_code=_unique_join_code(),
                max_players=desired_max_players,
            )
            campaign_created = True
        elif campaign.max_players < desired_max_players:
            campaign.max_players = desired_max_players
            campaign.save(update_fields=["max_players"])

        permissions = _ensure_permissions()
        roles = _ensure_roles()

        user_model = get_user_model()
        created_users = 0
        updated_users = 0
        created_memberships = 0
        updated_memberships = 0

        for index in range(1, count + 1):
            email = f"{prefix}{index}@{email_domain}".lower()
            display_name = f"Raider {index}"
            user, created = user_model.objects.get_or_create(
                username=email,
                defaults={"email": email, "first_name": display_name},
            )

            if created:
                user.set_password(password)
                user.save()
                created_users += 1
            else:
                updated = False
                if user.email != email:
                    user.email = email
                    updated = True
                if user.first_name != display_name:
                    user.first_name = display_name
                    updated = True
                if reset_passwords:
                    user.set_password(password)
                    updated = True
                if updated:
                    user.save()
                    updated_users += 1

            if index == 1:
                role = roles["owner"]
            elif index <= admin_count + 1:
                role = roles["admin"]
            else:
                role = roles["player"]

            membership, membership_created = CampaignMembership.objects.get_or_create(
                campaign=campaign,
                user=user,
                defaults={"role": role},
            )
            if membership_created:
                created_memberships += 1
            elif membership.role_id != role.id:
                membership.role = role
                membership.save(update_fields=["role"])
                updated_memberships += 1

            if membership.role.slug == "player":
                default_permissions = [
                    permissions.get("add_items"),
                    permissions.get("add_skills"),
                ]
                CampaignMembershipPermission.objects.bulk_create(
                    [
                        CampaignMembershipPermission(
                            membership=membership,
                            permission=permission,
                        )
                        for permission in default_permissions
                        if permission is not None
                    ],
                    ignore_conflicts=True,
                )

        member_count = CampaignMembership.objects.filter(campaign=campaign).count()
        required_max_players = max(desired_max_players, member_count + 1)
        if campaign.max_players < required_max_players:
            campaign.max_players = required_max_players
            campaign.save(update_fields=["max_players"])

        self.stdout.write(
            self.style.SUCCESS(
                "Campaign seed complete."
                f" Campaign: {campaign.name} (id={campaign.id}, join={campaign.join_code})"
                f" Users created: {created_users}, updated: {updated_users}."
                f" Memberships created: {created_memberships}, updated: {updated_memberships}."
            )
        )
