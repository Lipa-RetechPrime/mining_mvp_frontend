## 1. Purpose

The Mining Cost Estimation frontend shall provide a secure, role-based portal for managing tenants, users, mining projects, cost functions, cost inputs, and cost estimations.

The application shall support future addition, editing, disabling, and removal of features without requiring major frontend restructuring.

This document distinguishes:

- **Current MVP status** — what is already available
- **Active MVP phase** — ownership / outsourcing delivery-mode flow now in progress
- **Target product vision** — longer-term requirements that are not yet current status

Feature detail for the active delivery-mode phase also lives in `specs/002-ownership-outsourcing-flow/spec.md`.

## 2. Current MVP Status

The following are already present in the MVP (not future wishlist):

- User login and logout (session-based; some auth details may still evolve against backend APIs)
- Protected application routes
- Post-login landing on dashboard
- Project / mine listing and selection
- Project detail route that opens the cost-estimation workspace
- Cost estimation create, update, and delete (mine-level)
- Cost-item addition, editing, and deletion
- Entity tabs and sector navigation (mine side nav)
- Required design / electrification percent per entity (prefilled across cost items for that entity; editable)
- Phase-based investment entry and calculations on the form
- Overall investment summary view
- Excel download for a mine
- Loading, validation, confirmation, and error states
- Collapsible / context side navigation

**Known gaps vs full product vision (not claimed as done):**

- Full Super Admin / multi-tenant RBAC product surface is incomplete
- Some listing / selection data may still be partially static or placeholder alongside live investment APIs
- Dynamic cost-function metadata-driven forms (database-defined field schemas) are not the current estimation UX
- Ownership vs Outsourcing delivery-mode choice after project listing is **not yet shipped** (see §3)

## 3. Active MVP Phase — Ownership & Outsourcing Delivery Mode

### 3.1 Goal

After a user opens a project from the project listing, the product shall ask how the project is delivered before showing the existing estimation workspace. Modes and related options shall be master-driven and extensible.

`Requirement.md` target sections below remain the long-term vision; this section is the **near-term MVP increment**.

### 3.2 Delivery-mode modal (per cost function)

- Opening a project from the listing lands on the mine workspace; **Ownership / Outsourcing is chosen per cost function**, not for the whole mine.
- Selecting a Cost Function that has no saved delivery mode shall open a **modal** before showing Ownership estimation or Outsourcing configuration for that function.
- MVP options:
  - **Ownership**
  - **Outsourcing**
- Options shall be backed by a **delivery-type master** in the database (not permanently hard-coded as the only possible forever set).
- Closing / canceling without a choice shall not apply a mode for that function; the user may pick another Cost Function.
- Once a mode is saved for a **mine + function**, reopen of that function may skip the modal; the user shall still be able to change mode later via an explicit action (with confirmation if switching would hide or orphan data).
- Different cost functions on the same mine may use different delivery modes.

### 3.3 Ownership path

- If the user selects **Ownership**, land on the **existing** cost-item flow:
  - Creation screen when no cost items exist
  - Editing / management screen when cost items exist
- Existing Ownership estimation behaviour (cost items, phases, electrification %, overall, Excel) remains the baseline and must not regress.

### 3.4 Outsourcing path

- If the user selects **Outsourcing**, show a screen with two contribution options (extensible later):

#### 3.4.1 Partial contribution by outsourcing agent

- MVP default / only agent option for now: **External Agent**
- Later: additional agents such as **MDO** may be added via master / catalog
- After selection, show inputs:
  - **Payback period**
  - **Escalation percentage** — for the **current cost function only** (the function selected in Cost Functions navigation). Values are stored **per function** so the percentage can differ when the user switches functions; the form must not list every function’s escalation on one screen.

#### 3.4.2 Full contribution by outsourcing agent

- MVP default / only model for now: **Flat rate of interest**
- After selection, show inputs:
  - **Payback period**
  - **Escalation percentage**
  - **Phase from which payback starts** — dropdown sourced from the **phase master**

### 3.5 Persistence and extensibility

- Persist delivery mode and outsourcing configuration against the **mine + cost function** so values reload when that function is selected again.
- Validate required outsourcing fields before save.
- Structure UI and data so delivery types, agent types, contribution models, and calculation rules can change later without redesigning the Ownership vs Outsourcing journey.
- **Out of scope for this MVP increment unless separately specified:** full outsourcing financial calculation engine, overall-table formula changes, and Excel layout changes for outsourcing outcomes.

### 3.6 Active-phase acceptance (MVP increment)

1. Project open from listing goes to the mine workspace; Cost Function selection shows delivery-mode modal when no mode is saved for that function.
2. Ownership for a function routes to current create/edit cost-item experience correctly.
3. Outsourcing for a function offers Partial (External Agent) and Full (Flat rate) with the inputs above.
4. Saved mode and outsourcing inputs restore when reopening the same function.
5. Masters / catalogs allow additional options later without a new top-level journey.
6. Ownership cost-item smoke paths remain green.

## 4. User Types *(target product vision)*

### 4.1 Super Admin

A Super Admin may, subject to assigned RBAC permissions:

- Add tenants
- View and search tenants
- Edit tenant details
- Activate, deactivate, or remove tenants
- Configure tenant validity periods
- Add and manage tenant administrators
- View system-wide projects and activity
- Manage global cost-function definitions
- Manage roles and permissions

### 4.2 Tenant User

A tenant user may, subject to assigned RBAC permissions:

- View projects belonging to their tenant
- Add new projects
- Edit project details
- Remove projects
- View and manage cost estimations
- Choose Ownership or Outsourcing delivery mode for a project
- Configure outsourcing contribution settings when applicable
- Add, edit, or remove cost items (Ownership path)
- View overall investment calculations
- Download permitted reports

A tenant user must not access data belonging to another tenant.

### 4.3 Additional Roles

The system shall support adding roles such as Tenant Admin, Estimator, Reviewer, and Read-only User without significant frontend changes.

## 5. Authentication *(target)*

- Users shall authenticate through a backend authentication API.
- The frontend shall securely maintain the authenticated session.
- Unauthenticated users shall be redirected to the login page.
- Logout shall clear the session and redirect to login.
- Expired or invalid sessions shall be handled automatically.
- The authenticated user response shall include tenant, role, and permission information.
- Authentication failures shall display clear, non-sensitive error messages.

## 6. Role-Based Access Control *(target)*

RBAC shall be permission-driven rather than based only on hard-coded role names.

Example permissions include:

- `tenant.create`
- `tenant.view`
- `tenant.edit`
- `tenant.delete`
- `user.create`
- `user.view`
- `user.edit`
- `user.delete`
- `project.create`
- `project.view`
- `project.edit`
- `project.delete`
- `cost-function.configure`
- `estimation.create`
- `estimation.view`
- `estimation.edit`
- `estimation.delete`
- `outsourcing.configure`
- `report.download`

The frontend shall:

- Show only permitted navigation items.
- Hide or disable unauthorized actions.
- Protect routes based on permissions.
- Display an access-denied page for unauthorized routes.
- Re-evaluate permissions after login and session refresh.

The backend remains responsible for authoritative authorization enforcement.

## 7. Tenant Management *(target)*

Authorized users shall be able to:

- Add a tenant
- View tenant details
- Search and filter tenants
- Edit tenant details
- Activate or deactivate a tenant
- Remove a tenant when permitted

Tenant information includes:

- Tenant name
- Address
- Mobile number
- Contact person
- Active-until date
- Status

Destructive actions shall require confirmation.

## 8. User Management *(target)*

Authorized users shall be able to:

- Add users under a tenant
- View and search users
- Edit user details
- Assign or change roles
- Activate or deactivate users
- Remove users
- Reset or initiate password recovery

Users shall only be assignable to roles allowed within their tenant and by the acting user’s permissions.

## 9. Project and Mine Management

### 9.1 Current / near-term behaviour

Authorized users shall be able to:

- View existing projects (listing)
- Open a project and choose delivery mode (Ownership / Outsourcing) — **active MVP**
- Continue into Ownership cost estimation or Outsourcing configuration per §3
- Switch between accessible projects where the UI allows

Projects shall be tenant-scoped when multi-tenant auth is fully wired.

### 9.2 Target listing behaviour

The project list should ultimately show:

- Project or mine name
- Unique identifier
- Last-updated date
- Status
- Saved delivery mode (when set)
- Available actions based on permissions

Target CRUD (add / edit / remove projects) remains required for the full product but is not all claimed as current status.

## 10. Dynamic Cost Functions *(target vision — not current estimation UX)*

### 10.1 Cost-Function Definitions

Cost functions shall be loaded from the database through backend APIs.

The frontend must not hard-code the available cost functions or their input fields in the long-term product.

Each cost-function definition should provide:

- Unique ID
- Name
- Description
- Category or sector
- Display order
- Active status
- Version
- Input-field definitions
- Calculation configuration
- Applicable entities
- Effective dates, where required

Inactive or removed cost functions shall not be available for new estimations unless explicitly required for historical records.

### 10.2 Dynamic Input Definitions

Inputs shall vary by cost function and shall also come from the database.

Each input definition should support:

- Unique field ID or key
- Display label
- Data type
- Required or optional status
- Default value
- Placeholder
- Help text
- Display order
- Minimum and maximum values
- Decimal precision
- Allowed options
- Validation rules
- Unit of measurement
- Read-only or editable state
- Visibility conditions
- Dependency on another field

Supported input types should include:

- Text
- Multiline text
- Integer
- Decimal
- Percentage
- Currency
- Date
- Boolean
- Single-select
- Multi-select

The frontend shall render forms dynamically from this metadata.

Adding or modifying a supported field definition in the database should not require a frontend deployment.

### 10.3 Dynamic Form Behaviour

The frontend shall:

- Fetch the selected cost function and its input definitions.
- Render inputs in the configured order.
- Apply server-provided defaults and validation constraints.
- Support conditional field visibility.
- Preserve user-entered values when validation fails.
- Display field-level and form-level errors.
- Submit the cost-function ID, definition version, and entered values.
- Handle unsupported input types safely.
- Prevent submission while required metadata is unavailable.

Calculation formulas must be evaluated by the backend unless a frontend calculation is explicitly approved for display purposes.

## 11. Cost Estimation

### 11.1 Current Ownership estimation (MVP)

Authorized users on the Ownership path shall be able to:

- Create an estimation (mine)
- View / edit / delete estimations
- Add, edit, and remove cost items
- Select calculation modes (where available on the form)
- Configure phases within mine phase limits
- Enter / edit design–electrification percent per entity (required when the entity has populated cost items)
- View calculated amounts
- View overall investment totals
- Download Excel for the mine

An Ownership estimation may contain:

- Project or mine reference
- Sector / function blocks
- Entity tabs
- Cost items (details, manpower, quantities, unit costs, amounts)
- Phase values and percentages
- Electrification / design percentages
- Created and updated timestamps

Deleting an estimation or cost item shall require confirmation.

### 11.2 Outsourcing configuration (active MVP)

See §3. Capture and persist Partial / Full outsourcing inputs against the project. Financial outcome engines for outsourcing are deferred unless specified later.

## 12. Master Data Relevant to Delivery Modes *(active MVP)*

The following catalogs shall exist (seeded for MVP; admin UIs may come later):

- **Delivery type master** — e.g. Ownership, Outsourcing
- **Outsourcing agent type** — e.g. External Agent (later MDO)
- **Full contribution variant** — e.g. Flat rate of interest
- **Phase master** — used for “phase from which payback starts”
- **Cost functions / sectors** — used for function-wise escalation under Partial outsourcing

## 13. Data and API Handling

- Production data shall increasingly come from backend APIs (already true for core investments / percentages / mine delete).
- API URLs shall be configured through environment settings.
- Requests shall include authentication credentials where required.
- Loading states shall be displayed during requests.
- Errors shall be shown in a user-friendly manner.
- Validation errors returned by the backend shall be mapped to relevant fields where practical.
- Duplicate submissions shall be prevented.
- The UI shall refresh or update local state after successful mutations.
- Removed or changed cost-function definitions shall not corrupt historical estimations (target).

## 14. Add, Edit, and Remove Scope *(target architecture)*

The frontend architecture shall support add, edit, view, deactivate, and remove operations for:

- Tenants
- Users
- Roles and permissions
- Projects and mines
- Delivery modes / related catalogs (as product ownership of masters matures)
- Cost functions
- Cost-function input definitions
- Cost estimations
- Cost items
- Phases
- Outsourcing configurations

Each managed entity should support:

- List view
- Detail view
- Add form
- Edit form
- Delete or deactivate confirmation
- Permission checks
- Validation
- Loading and error states
- Success notification

Where records are referenced by historical data, deactivation or soft deletion should be preferred over permanent deletion.

## 15. Extensibility

New modules should be addable through:

- Route configuration
- Navigation configuration
- Permission configuration
- Reusable list and form components
- Dynamic field definitions
- Feature flags where necessary
- Master / catalog values for delivery and outsourcing options

Navigation visibility shall depend on user permissions and enabled features.

Unknown fields returned by the backend shall not break the application.

API and cost-function definitions should be versioned to preserve compatibility with existing estimations.

Ownership vs Outsourcing navigation and configuration models must remain additive so requirements and calculation logic can evolve.

## 16. User Experience

- The layout shall work across common desktop and tablet screen sizes.
- The side navigation shall support collapse and expansion.
- Active navigation items shall be visually identifiable.
- Forms shall provide clear validation feedback.
- Destructive actions shall require confirmation.
- Long-running actions shall show progress.
- Successful actions shall show notifications.
- Empty states shall explain the next available action.
- Keyboard navigation and visible focus indicators shall be supported.
- Delivery-mode and outsourcing choices shall use clear progressive disclosure (modal → contribution type → inputs).

## 17. Security

- Tenant data shall remain isolated (target / as auth wiring completes).
- RBAC shall be enforced by both frontend and backend (target maturity).
- Sensitive information shall not be stored in browser logs.
- API and authentication errors shall not expose internal details.
- User-provided content shall be safely rendered.
- Sessions shall expire according to backend policy.
- Deactivated users and tenants shall lose access.
- Dynamic formula definitions must not permit arbitrary frontend code execution.

## 18. Non-Functional Requirements

- TypeScript shall remain enabled.
- Production builds shall pass type checking.
- Reusable components shall be preferred.
- API logic shall remain separate from presentation components.
- The UI shall handle slow or unavailable APIs gracefully.
- Large project and tenant lists should support pagination.
- Search and filtering should use backend processing when datasets become large.
- Important workflows should have automated tests.

## 19. Acceptance Criteria

### 19.1 Current MVP baseline (already expected)

1. Users can sign in and reach protected routes.
2. Projects can be listed and opened into an estimation workspace.
3. Estimations and cost items support create / edit / delete with confirmation where required.
4. Electrification / design percent is required per entity with populated items and persists for later items on that entity.
5. Overall view and Excel download work for a saved mine.
6. Loading, empty, success, and failure states are available on core flows.
7. Type checking and production builds succeed.

### 19.2 Active MVP phase (ownership / outsourcing)

1. Opening a project without a saved delivery mode shows Ownership / Outsourcing modal first.
2. Ownership continues the existing cost-item create/edit path.
3. Outsourcing exposes Partial (External Agent) and Full (Flat rate) with the specified inputs.
4. Configuration persists and reloads; validation blocks incomplete saves.
5. Catalog / master structure supports later options (e.g. MDO) without a new journey.
6. No Ownership estimation regression on the smoke checklist.

### 19.3 Full product readiness *(target — not current status)*

1. Authentication uses the backend API end-to-end with role/permission payloads.
2. Tenant and Super Admin users receive appropriate permissions.
3. Unauthorized routes and actions are inaccessible.
4. Tenant data is isolated.
5. Projects can be added, viewed, edited, and removed by authorized users.
6. Cost functions are loaded from the database.
7. Cost-function inputs are dynamically rendered from database definitions.
8. Dynamic inputs are validated and submitted successfully.
9. Historical estimations remain readable after cost-function definitions change.

## 20. Open Questions

The following still require stakeholder confirmation for the broader product:

- Is “Tenant” a role, an organization, or both?
- Is a separate Tenant Admin role required?
- Which role may configure cost functions and their fields?
- Can cost-function definitions be deleted, or only deactivated?
- Are calculations executed entirely by the backend?
- Is approval or review required before an estimation becomes final?
- Are audit logs required for changes and deletions?
- Is permanent deletion allowed for tenants, users, and projects?
- Which report formats are required besides Excel?
- Are cost functions shared globally or configurable per tenant?
- Payback period unit for outsourcing (default assumption: years) — confirm with stakeholders.
- When switching Ownership ↔ Outsourcing, what happens to existing cost items vs outsourcing config (confirm/clear/keep-both)?
- When do outsourcing financial calculations and Excel / overall impacts enter scope?

## 21. Document Control

- Active delivery-mode feature spec: `specs/002-ownership-outsourcing-flow/spec.md`
- This file’s §2 and §3 are authoritative for **current vs active MVP**; later sections marked *(target)* are not current status claims.
- Prefer updating the feature spec for delivery-mode behaviour details, then syncing summary changes here.
