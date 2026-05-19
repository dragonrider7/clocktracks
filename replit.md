# TimeClock

A time clock web application for small teams (10-15 employees) to track daily clock in/out times, view who is currently working, and manage vacation and time off requests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/time-clock run dev` — run the frontend (port 18644)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (employees, timeEntries, timeOffRequests)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/time-clock/src/` — React frontend (pages, components)

## Architecture decisions

- Contract-first OpenAPI: all types flow from the spec → codegen → frontend hooks + server Zod schemas
- No authentication: employees select their name from a list to clock in (simple, kiosk-friendly)
- Role system: `employee` vs `admin` stored on the Employee record; UI differentiates admin actions
- Dashboard aggregates computed server-side: who's in, weekly hours, pending requests count
- Time entries track clockIn/clockOut as timestamps; totalMinutes computed on the fly in route handlers

## Product

- **Dashboard** — live view of who's clocked in, today's hours, pending time off requests, weekly hours per employee
- **Clock In/Out** — one-click clock in/out by selecting an employee name
- **Employees** — admin CRUD for managing employee records (name, department, role, PIN, email)
- **Time Log** — filterable table of all time entries; admins can edit or delete entries
- **Time Off** — three-tab page: Requests list, Calendar view, and Adjustments tab (time correction requests)
  - Sick time has its own balance separate from PTO; bereavement is tracked but deducts from nothing
  - Adjustment requests: employees submit add/edit/delete corrections; admins approve or deny
- **Admin** — `/admin` hub with pending counts, quick links to all admin sections, and the employee view toggle
  - The Admin nav link is always visible to actual admins, even when in Employee View Mode
- **Notification Bell** — nav bell icon with unread count; admins receive notifications for time-off and adjustment requests
- **Employee View Mode** — admins can browse the site as a regular employee; Admin panel remains accessible

## Authentication

- Auth provider: Clerk (Replit-managed, keys auto-provisioned)
- Login methods: email/password + Google (configured in Auth pane)
- **First user to create an account becomes admin.** Subsequent sign-ups become employees.
- Linking: when a user signs in, their Clerk account is linked to their employee record by email match, then by `clerkUserId`. If no match, a new employee record is created.
- Admin capabilities: manage employees, approve/deny time off, edit/delete time entries, clock in/out on behalf of others
- Employee capabilities: clock in/out for themselves, request time off, view their own time log
- The "Employees" nav item is hidden from non-admin users
- `clerkUserId` column is stored on the employees table (partial unique index, null-safe)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Holidays

- `holidays` DB table: id, name, date (YYYY-MM-DD TEXT), hoursPerDay (integer, default 8), createdAt, updatedAt
- CRUD via `GET/POST /holidays`, `PATCH/DELETE /holidays/:id`
- Holidays page (`/holidays`) is admin-only; visible in nav for admins
- In the timesheets report, holidays are added as entries for all employees (kind="time_off", timeOffType="holiday", notes=holiday name)
- Holidays do NOT reduce PTO balances

## Calendar / Reports week format

- Calendar (time-off page) and Reports presets both use **Sunday–Saturday** week format
- `getSundayOfWeek(date)` is the week-start helper in `reports.tsx`
- Calendar `firstOffset = firstDay.getDay()` (native JS Sunday=0 offset)

## Profile page

- `/profile` is a dedicated full page (navigated via the user dropdown)
- Shows employee info card (name, department, role, time off balance), then Clerk UserProfile for account settings (profile picture, name, password, etc.)
- The dialog approach has been replaced entirely

## Context file

- `useMe` is exported from `src/contexts/me-context.tsx` (NOT from App.tsx) — avoids circular imports and Fast Refresh issues
- `isAdmin` in MeContext = `me?.role === "admin" && !isViewingAsEmployee`; use `me?.role === "admin"` directly to check actual role regardless of view mode
- Time adjustments are embedded in the Time Off page as a third tab — there is no separate `/time-adjustments` route

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Google Fonts `@import url(...)` must be the very first line of `index.css` (before all other imports)
- Clock-out route is `PATCH /time-entries/:id/clock-out` (not `/time-entries/clock-out/:id`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
