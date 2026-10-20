from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.campaigns.constants import ADMIN, JOIN_GRANTS, OWNER, PLAYER
from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignPermission,
    CampaignRole,
    CampaignSettings,
)
from apps.campaigns.services.campaigns import unique_join_code
from apps.campaigns.services.codes import seed_roles_and_codes


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
        if count < 1:
            raise CommandError("--count must be at least 1 to create an owner.")

        admin_count = max(0, min(options["admins"], count - 1))
        max_players = options["max_players"]
        desired_max_players = max_players if max_players is not None else max(count + 1, 6)
        desired_max_players = max(desired_max_players, count + 1)
        campaign = _seed_campaign(options["campaign_name"], desired_max_players)

        seed_roles_and_codes()  # the migration seeds them; this keeps the command safe on any database
        roles = {role.slug: role for role in CampaignRole.objects.all()}
        join_grants = list(CampaignPermission.objects.filter(code__in=JOIN_GRANTS))

        tally = {"users created": 0, "users updated": 0, "memberships created": 0, "memberships updated": 0}
        for index in range(1, count + 1):
            user, user_created, user_updated = _seed_user(index, options)
            tally["users created"] += user_created
            tally["users updated"] += user_updated
            role = roles[OWNER] if index == 1 else roles[ADMIN] if index <= admin_count + 1 else roles[PLAYER]
            membership_created, membership_updated = _seed_membership(campaign, user, role, join_grants)
            tally["memberships created"] += membership_created
            tally["memberships updated"] += membership_updated

        member_count = CampaignMembership.objects.filter(campaign=campaign).count()
        _ensure_seats(campaign, max(desired_max_players, member_count + 1))

        self.stdout.write(
            self.style.SUCCESS(
                "Campaign seed complete."
                f" Campaign: {campaign.name} (id={campaign.id}, join={campaign.join_code})"
                f" Users created: {tally['users created']}, updated: {tally['users updated']}."
                f" Memberships created: {tally['memberships created']}, updated: {tally['memberships updated']}."
            )
        )


def _email(index, options):
    return f"{options['prefix']}{index}@{options['email_domain']}".lower()


def _ensure_seats(campaign, seats):
    """The campaign's settings, with at least `seats` places."""
    settings, _ = CampaignSettings.objects.get_or_create(campaign=campaign)
    if settings.max_players < seats:
        settings.max_players = seats
        settings.save(update_fields=["max_players"])


def _seed_campaign(name, seats):
    """The campaign with this name (made, with its settings, when missing), with at least `seats` places."""
    campaign = Campaign.objects.filter(name=name).first()
    if campaign:
        _ensure_seats(campaign, seats)
        return campaign
    campaign = Campaign.objects.create(name=name, join_code=unique_join_code())
    CampaignSettings.objects.create(campaign=campaign, max_players=seats)
    return campaign


def _seed_user(index, options):
    """Raider `index`: made with the password, or brought back to the seeded email and name; (user, created,
    updated)."""
    email = _email(index, options)
    display_name = f"Raider {index}"
    user, created = get_user_model().objects.get_or_create(
        username=email,
        defaults={"email": email, "first_name": display_name},
    )
    if created:
        user.set_password(options["password"])
        user.save()
        return user, True, False
    updated = False
    if user.email != email:
        user.email = email
        updated = True
    if user.first_name != display_name:
        user.first_name = display_name
        updated = True
    if options["reset_passwords"]:
        user.set_password(options["password"])
        updated = True
    if updated:
        user.save()
    return user, False, updated


def _seed_membership(campaign, user, role, join_grants):
    """The user's membership with this role (players also get the join grants); (created, updated)."""
    membership, created = CampaignMembership.objects.get_or_create(
        campaign=campaign, user=user, defaults={"role": role}
    )
    updated = False
    if not created and membership.role_id != role.id:
        membership.role = role
        membership.save(update_fields=["role"])
        updated = True
    if membership.role.slug == PLAYER:
        CampaignMembershipPermission.objects.bulk_create(
            [CampaignMembershipPermission(membership=membership, permission=entry) for entry in join_grants],
            ignore_conflicts=True,
        )
    return created, updated
