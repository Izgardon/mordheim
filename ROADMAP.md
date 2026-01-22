# Roadmap

## Completed
- [x] Dockerized stack (Django + React + Postgres) with hot reload
- [x] Auth (email + password) with JWT
- [x] Campaigns CRUD, join by code, memberships, roles, and permissions
- [x] Campaign layout with sidebar + overview + settings
- [x] Items + skills data models, seeders, list/filter endpoints
- [x] Custom skill/item creation with admin permission gates
- [x] Warbands per campaign
- [x] Heroes CRUD with stats, skills, items, and summary view
- [x] House rules tab and API (owner/admin with permission)

## In Progress
- [ ] Expand hero sheet to match the full Excel layout
- [ ] Warband sections (henchmen, hired swords)
- [ ] Warband view permissions and sharing

## Next
- [ ] Advanced filters for items/skills
- [ ] Admin/owner tooling for campaign management
- [ ] Password reset flow

## Later
- [ ] Campaign events, injuries, and advancement tracking
- [ ] Export + printable sheets
- [ ] Public rules reference and glossary
- [ ] Automated sheet parsing for warband import

## Database (Current Shape)
| Table | Purpose |
| --- | --- |
| auth_user | User accounts |
| campaign | Campaign records |
| campaign_role | Roles (owner/admin/player) |
| campaign_permission | Admin permission codes |
| campaign_role_permission | Admin permission assignments per campaign |
| campaign_membership | User membership per campaign |
| campaign_house_rule | House rules per campaign |
| warband | Warbands per campaign/user |
| warband_hero | Heroes per warband |
| warband_hero_item | Pivot hero <-> item |
| warband_hero_skill | Pivot hero <-> skill |
| item | Items catalogue |
| skill | Skills catalogue |
