# Locations and Encampments Plan

## Goal
- Add campaign-specific `Locations` and `Encampments` features with their own pages, data tables, forms, permissions, and action-log support.

## Scope
- `Standard` campaigns keep both features off by default.
- `Marienburg` campaigns auto-enable both features on campaign creation.
- Exact database schema is still TBD.

## Main Deliverables
- 2 new database tables:
  - one for campaign locations
  - one for campaign encampments
- Campaign settings controls so the campaign owner can enable/disable both features
- Campaign-scoped API fetching for both features
- 2 new frontend pages:
  - `Locations`
  - `Encampments`
- Mobile nav entry points for both pages
- Create/edit forms for both feature types
- View/edit permission rules
- Action log support for encampments being marked as `explorable`

## Suggested Build Order

### 1. Data Model
- Add 2 new campaign-linked tables for locations and encampments.
- Keep schema flexible for now and finalize fields after the page UX is clearer.
- Decide early whether both tables need:
  - name
  - notes/description
  - campaign foreign key
  - created/updated timestamps
  - status flags
- Add an `explorable` field or equivalent state on encampments.

### 2. Backend API
- Add campaign-specific list/create endpoints for locations.
- Add campaign-specific list/create endpoints for encampments.
- Add update endpoints for editing both records.
- Scope all reads and writes to the active campaign.
- Only expose these endpoints when the campaign settings enable the feature.

### 3. Campaign Settings
- Add owner-managed campaign settings toggles for:
  - locations
  - encampments
- Show these in the campaign settings UI.
- Reuse the existing campaign settings update flow instead of creating a separate endpoint if possible.
- Decide whether turning a feature off should:
  - hide the page only
  - block new writes
  - block all reads
  - preserve existing data without deleting anything

### 4. Permissions
- Define who can view locations.
- Define who can create/edit locations.
- Define who can view encampments.
- Define who can create/edit encampments.
- Reuse the existing campaign membership/permission model where possible instead of inventing a separate system.

### 5. Action Log
- Add action-log entries when an encampment is marked `explorable`.
- Decide whether the log should also capture:
  - creation
  - edits
  - explorable toggled off again
- Make sure action-log entries are campaign-specific and visible in the existing log UI.

### 6. Frontend Pages
- Add a `Locations` page for listing and managing campaign locations.
- Add an `Encampments` page for listing and managing campaign encampments.
- Keep the first version simple:
  - table/list view
  - create button
  - edit action
  - empty state
- Hide or disable the pages when the campaign setting for that feature is off.

### 7. Forms
- Add a create/edit form for locations.
- Add a create/edit form for encampments.
- Include the `explorable` control in the encampment form if that is meant to be directly editable.
- If `explorable` is a workflow action instead of a normal field edit, give it a separate button/action instead of burying it in the form.

### 8. Navigation
- Add both pages to the campaign mobile nav.
- Decide whether they also belong in the desktop campaign nav at the same time.
- Keep placement near other campaign management pages so they are easy to find.

## First Pass Acceptance Criteria
- A `Marienburg` campaign can access both pages immediately.
- A `Standard` campaign does not show the features unless manually enabled later.
- The campaign owner can enable or disable both features from campaign settings.
- Users can create and edit locations.
- Users can create and edit encampments.
- Encampments can be marked `explorable`.
- Marking an encampment `explorable` creates an action-log entry.
- Permission checks prevent unauthorized edits.

## Open Decisions
- Final schema for both tables
- Whether `explorable` is a boolean, status enum, or workflow event
- Whether permissions should be shared under one campaign permission or split by feature
- Whether these pages should be visible-but-disabled or fully hidden when turned off
- What behavior should apply to existing locations/encampments when a feature is toggled off
