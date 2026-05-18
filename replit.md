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
- **Time Off** — calendar + list of vacation/sick/personal requests; admins can approve or deny

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

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Google Fonts `@import url(...)` must be the very first line of `index.css` (before all other imports)
- Clock-out route is `PATCH /time-entries/:id/clock-out` (not `/time-entries/clock-out/:id`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
