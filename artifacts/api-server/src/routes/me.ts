import { Router, type IRouter } from "express";
import { eq, isNotNull, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";
import { db, employeesTable } from "@workspace/db";

const router: IRouter = Router();

/** Case-insensitive, whitespace-trimmed email lookup. */
async function findEmployeeByEmail(email: string) {
  const normalised = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(employeesTable)
    .where(sql`LOWER(TRIM(${employeesTable.email})) = ${normalised}`);
  return row ?? null;
}

router.get("/me", async (req, res): Promise<void> => {
  // Ghost super-admin session — bypass Clerk entirely
  const signedCookies = (req as unknown as { signedCookies: Record<string, string> }).signedCookies;
  if (signedCookies?.["_ctsa_s"] === "1") {
    res.json({
      id: -1,
      name: "clocktracksadmin",
      pin: null,
      role: "admin",
      department: null,
      email: "clocktracksadmin@clocktracks.dev",
      clerkUserId: null,
      timeOffAllotmentHours: 0,
      hiredDate: null,
      birthday: null,
      imageUrl: null,
      sickTimeAllotmentHours: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
    return;
  }

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 1. Already linked — fast path
  let [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.clerkUserId, clerkUserId));

  // Sync imageUrl if it is not yet cached
  if (employee && !employee.imageUrl) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      if (clerkUser.imageUrl) {
        [employee] = await db
          .update(employeesTable)
          .set({ imageUrl: clerkUser.imageUrl })
          .where(eq(employeesTable.id, employee.id))
          .returning();
      }
    } catch (err) {
      req.log.warn({ err }, "Could not sync imageUrl from Clerk");
    }
  }

  if (employee) {
    res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
    return;
  }

  // 2. New sign-in — fetch Clerk user details
  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Clerk user");
    res.status(500).json({ error: "Failed to look up user" });
    return;
  }

  // Use the primary email from Clerk, trimmed
  const email = clerkUser.emailAddresses?.[0]?.emailAddress?.trim() ?? null;

  // 3. Has anyone ever signed in? (any employee with a linked Clerk user ID)
  //    Using linked count rather than total count so pre-seeded employee
  //    records don't block the bootstrap admin on a fresh install.
  const [{ count: linkedCount }] = await db
    .select({ count: db.$count(employeesTable) })
    .from(employeesTable)
    .where(isNotNull(employeesTable.clerkUserId));

  const isFirstEverLogin = Number(linkedCount) === 0;

  if (isFirstEverLogin) {
    // ── Bootstrap admin ────────────────────────────────────────────────────
    // First person to ever sign in becomes admin regardless of any pre-seeded
    // employee records. Email match is case-insensitive so it works even if
    // the admin typed the email with different capitalisation.

    const existingByEmail = email ? await findEmployeeByEmail(email) : null;

    if (existingByEmail) {
      [employee] = await db
        .update(employeesTable)
        .set({ clerkUserId, role: "admin", email, imageUrl: clerkUser.imageUrl ?? null })
        .where(eq(employeesTable.id, existingByEmail.id))
        .returning();
    } else {
      const name =
        clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName || clerkUser.username || email || "Admin";

      [employee] = await db
        .insert(employeesTable)
        .values({ name, email, clerkUserId, role: "admin", imageUrl: clerkUser.imageUrl ?? null })
        .returning();
    }
  } else {
    // ── Normal flow ────────────────────────────────────────────────────────
    // Only allow sign-in if the Clerk email matches a pre-existing employee
    // record. Match is case-insensitive and whitespace-tolerant so typos in
    // the admin panel don't silently block employees from logging in.

    if (email) {
      const byEmail = await findEmployeeByEmail(email);

      if (byEmail) {
        // Also normalise the stored email to Clerk's canonical form so the
        // LOWER() lookup is never needed again for this employee.
        [employee] = await db
          .update(employeesTable)
          .set({ clerkUserId, email, imageUrl: clerkUser.imageUrl ?? null })
          .where(eq(employeesTable.id, byEmail.id))
          .returning();
      }
    }

    if (!employee) {
      req.log.warn({ clerkUserId, email }, "Sign-in blocked: no matching employee record");
      res.status(403).json({ error: "not_authorized" });
      return;
    }
  }

  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

export default router;
