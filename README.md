# Lantern Roster

A mobile-first roster system for every Lantern site, replacing the Gravity Forms **Tenant Updater**.
Staff add, update and remove residents in a couple of taps, and a **review queue** flags anyone
who hasn't appeared on any form for 48 hours. Swipe left to remove (always confirmed, always
undoable), swipe right to keep.

The UI shell (sidebar, bottom tab bar, profile and themes, sign-in screen, design tokens) is
copied from `lcs_invoices` (Lantern AP), so both apps look and behave the same.

---

## Quick start (local prototype)

Needs Node 20+. No database server: the prototype runs on SQLite.

```bash
cd backend && npm install && npx prisma db push && npm run seed && npm run dev
```

```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:5273**. Until Entra is configured, the sign-in screen offers **Prototype
sign-in** with five demo accounts (admin, site manager, staff, a partner "Google Workspace" staff
member, viewer). This is always off when `NODE_ENV=production` or `DEV_AUTH=false`.

The seed imports the tenant list from `data/tenant_list.csv` if it's there. **That file is not in
the repository** and must never be committed: it's real resident data, and `data/` is git-ignored.
Copy the property-management export (columns `Property, Unit, Tenant`) there locally. Without it,
the seed still creates the demo accounts, and you can import later from Admin → Import tenant list.
**Demo only:** it also backdates the review clock on ~7% of residents so the 48-hour queue has
people in it on day one. Set `SEED_DEMO_QUEUE=false` to skip that. `npm run db:reset` starts over.

---

## How it works

| Concept | What it means |
|---|---|
| **Roster ID** | Every resident has a permanent id. Forms and WordPress store the id, never the name, so a spelling fix can't make someone look inactive. |
| **Attention clock** | Latest of: added to roster, named on a form (`/api/v1/activity`), or a staff member tapping **Keep** / **Still here**. Editing details does *not* reset it. |
| **Review queue** | Active residents whose clock is older than the threshold (48h org-wide, overridable per site, e.g. 24h for shelters). |
| **Remove** | Archives, never deletes. A reason is required; Undo is offered right away, and site managers can restore any time later. |
| **Concurrency** | Every edit carries the version it was loaded from. If a colleague saved first, you get a "someone else changed this" prompt instead of silently overwriting them. |
| **Audit** | Every add/edit/remove/keep/restore is recorded with who, when and why (Activity screen, and on each resident's page). |

### Roles

| Role | Can |
|---|---|
| Viewer | See rosters |
| Site staff | Add, edit, keep, remove at their sites |
| Site manager | Staff + restore removed residents + full audit history |
| Administrator | Everything, every site: sites, people, sign-in access, integrations, rules |

Site access is assigned per person in Admin → People & roles. Everyone except administrators
sees **only** the rosters of their assigned sites (no sites assigned = no rosters); the API enforces
this on every request, including a hand-typed `?site=` for a site they aren't on.

Every site filter (Dashboard, Roster, Review, Activity) is a multi-select that defaults to **All my
sites** and lists only the sites the person is assigned to. Pick one site, any combination, or All.
The selection is kept in the URL (`?site=amber-hall,jasper`) and remembered per device, so all four
screens open on the same view. The API takes the same comma-separated `site` parameter.

### Export and print

The Roster screen has **Print** and **Export** (CSV, Excel, PDF) buttons; on a phone both sit in the
"…" menu next to Add. Every format contains exactly what's on screen: the selected sites, the
current tab (On roster / Review / Removed) and any search text.

- **CSV:** UTF-8 with a BOM so Excel opens accented names correctly. Cells that look like
  formulas are neutralised.
- **Excel:** a single sheet holding a real Excel table named `Roster`, with filter buttons,
  banded rows, a frozen header and date formatting.
- **PDF:** US Letter, grouped by site, with the column header repeated on every page. Each row has
  an empty "Seen" box so a printout doubles as a headcount sheet, and residents due for review are
  marked with an amber dot.
- **Print:** opens the same PDF in the browser's print dialog. On iPhone and Android it opens the
  PDF in a new tab instead, where Print is in the share menu.

Staff notes are left out of every format. Each export and printout is recorded in the Activity
log with the sites, the tab and the row count. The API equivalent is
`GET /api/tenants/export?format=csv|xlsx|pdf&site=…&status=…&q=…` (it needs a signed-in session).

---

## Getting rosters into WordPress

Three ways, pick per need. All use an API key from **Admin → API keys**
(`Authorization: Bearer lrk_…`).

1. **Pull** — `GET /api/v1/sites/{code}/roster` (JSON), or `GET /api/v1/sites/{code}/choices`,
   already shaped as a Gravity Forms `choices` array.
2. **Push** — **Admin → Webhooks** POSTs `tenant.created | updated | archived | restored | kept |
   activity` events, HMAC-SHA256 signed (`X-Lantern-Signature: sha256=…`).
3. **Sync** — `GET /api/v1/roster/changes?since=<ISO>` returns everything changed since a
   timestamp (removals included) plus a `next` cursor. Use it to catch up after a missed webhook.

**Activity back into the roster:** `POST /api/v1/activity` with `{ label, externalRef, tenantIds: [...] }`.
`externalRef` (e.g. `gf-12-5531`) makes retries idempotent. Forms that only captured free text
can send `{ match: [{ site, unit, name }] }`. An ambiguous match is reported and never guessed.

### The connector plugin

`integrations/wordpress/lantern-roster-connector.php` does all of this for Gravity Forms:

- a field with CSS classes `lantern-roster lantern-site-amber-hall` is filled with the live roster
  (cached 5 min, falling back to the last good copy if the API is down);
- on submit, the selected residents are posted to `/activity` (failures are queued and retried hourly);
- `POST /wp-json/lantern-roster/v1/webhook` verifies the signature and refreshes dropdowns immediately;
- `[lantern_roster site="…"]` renders a roster table for logged-in staff only.

Setup steps are also on **Admin → WordPress setup** inside the app.

---

## Sign-in: Microsoft, Google Workspace and partners

The app speaks OIDC to **one** authority, Lantern's Entra tenant. It's the same auth code as
Lantern AP (MSAL, PKCE, signed session cookie). Everyone outside Lantern comes through Entra
External ID as a B2B guest:

- **Google Workspace partner orgs:** SAML federation with Google Workspace as the IdP
  (Entra → External Identities → SAML/WS-Fed). Microsoft documents the built-in "Google"
  provider as Gmail-only, so Workspace domains need the SAML route.
- **Individual Gmail users:** Entra's built-in Google identity provider.
- **Anyone else:** Entra email one-time passcode, or their own Entra tenant.

Access is still decided here. An unknown account files an access request. Admins either invite
specific people (People & roles) or admit a partner domain (Sign-in access). The `idp` claim is
recorded, so you can see who signed in via Google.

To enable it, register an app in Entra (single tenant, Web redirect
`http://localhost:5273/api/auth/microsoft/callback`) and put `MICROSOFT_TENANT_ID`,
`MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `backend/.env.local`.

---

## Database

- `backend/prisma/schema.prisma` is the source of truth. Tables: `Site`, `Tenant`,
  `TenantActivity`, `AuditEvent`, `User`, `UserSite`, `ApiKey`, `Webhook`, `WebhookDelivery`,
  `Setting`.
- `database/azure-sql-schema.sql` is the same schema as T-SQL for Azure SQL, regenerated with
  `npm run sql:azure`. String columns are sized so every index fits SQL Server's key limit.
- The schema avoids enums, scalar lists and JSON columns, and has no nullable unique columns
  (SQL Server allows only one NULL per unique index), so it runs unchanged on SQLite and SQL Server.

### Moving to Azure SQL

1. In `schema.prisma`, set `provider = "sqlserver"` and add `@db.NVarChar(n)` sizes matching
   `scripts/export-azure-sql.ts`.
2. Set `DATABASE_URL="sqlserver://<server>.database.windows.net:1433;database=lantern-roster;…;encrypt=true"`.
3. Run `npx prisma migrate dev --name init`, then `npm run seed` (or the importer below).

### Importing a tenant list

From the app: **Admin → Import tenant list** (preview first, then commit). From the CLI:

```bash
npm run import:tenants -- ../data/            (git-ignored) local tenant list CSV — resident data, never committed
```

```bash
npm run import:tenants -- ../data/tenant_list.csv --commit
```

Expects `Property, Unit, Tenant` columns and handles Excel's Windows-1252 encoding. It parses
`"Last, First"`, nicknames in quotes or parentheses (`Sample, Robert "Bobby"` becomes Robert Sample,
goes by Bobby), and legal suffixes on site names (`Amber Hall LP` becomes site `amber-hall`). It is
re-runnable and **only adds**: a person missing from a new export is left for the review queue
rather than removed automatically.

---

## Layout

```
backend/    Express + Prisma API (port 4100)
  prisma/schema.prisma, seed.ts
  src/routes/     auth, tenants, sites, activity, users, admin, publicApi (/api/v1)
  src/services/   roster (attention clock), tenantImport, webhooks, audit, apiKeys, settings, permissions
  scripts/        import-tenants.ts, export-azure-sql.ts
frontend/   Next.js-hosted React SPA (port 5273, proxies /api → backend)
  src/screens/    Dashboard, Roster, Review, TenantDetail, Activity, Profile, More, admin/*
  src/components/ shell (from lcs_invoices), ui (from lcs_invoices), roster/*
integrations/wordpress/lantern-roster-connector.php
database/azure-sql-schema.sql
data/            (git-ignored) local tenant list CSV — resident data, never committed
```

## Known gaps (prototype)

- No automated tests yet. The flows were exercised by hand and through the API.
- Outbound webhooks are sent once, with no retry queue. Receivers catch up via `/roster/changes`.
- The WordPress plugin hasn't been run against a real WordPress yet (no PHP on the dev box).
  Test it on a staging copy of forms.lanterncommunity.org first.
- Only a few forms produce activity until the connector is on them. Until then, expect the
  review queue to be busy and rely on **Keep**.
- Hosting: the intended target is Azure App Service + Azure SQL. No deployment scripts yet.
