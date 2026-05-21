import { Router, type IRouter } from "express";
import { eq, isNotNull } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";
import { db, employeesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
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

  const email = clerkUser.emailAddresses?.[0]?.emailAddress;

  // 3. Has anyone ever signed in? (any employee with a linked Clerk user ID)
  //    This is more reliable than counting rows because pre-seeded employee
  //    records (with no clerkUserId) should not block the bootstrap admin.
  const [{ count: linkedCount }] = await db
    .select({ count: db.$count(employeesTable) })
    .from(employeesTable)
    .where(isNotNull(employeesTable.clerkUserId));

  const isFirstEverLogin = Number(linkedCount) === 0;

  if (isFirstEverLogin) {
    // ── Bootstrap admin ────────────────────────────────────────────────────
    // First person to ever sign in becomes admin regardless of any pre-seeded
    // employee records. If their email matches an existing record we promote
    // it to admin; otherwise we create a fresh one.

    let existingByEmail = null;
    if (email) {
      [existingByEmail] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.email, email));
    }

    if (existingByEmail) {
      [employee] = await db
        .update(employeesTable)
        .set({ clerkUserId, role: "admin", imageUrl: clerkUser.imageUrl ?? null })
        .where(eq(employeesTable.id, existingByEmail.id))
        .returning();
    } else {
      const name =
        clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName || clerkUser.username || email || "Admin";

      [employee] = await db
        .insert(employeesTable)
        .values({ name, email: email ?? null, clerkUserId, role: "admin", imageUrl: clerkUser.imageUrl ?? null })
        .returning();
    }
  } else {
    // ── Normal flow ────────────────────────────────────────────────────────
    // System already has signed-in users. Only allow sign-in if the Clerk
    // email matches a pre-existing employee record (created by an admin).

    if (email) {
      const [byEmail] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.email, email));

      if (byEmail) {
        [employee] = await db
          .update(employeesTable)
          .set({ clerkUserId, imageUrl: clerkUser.imageUrl ?? null })
          .where(eq(employeesTable.id, byEmail.id))
          .returning();
      }
    }

    if (!employee) {
      res.status(403).json({ error: "not_authorized" });
      return;
    }
  }

  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

export default router;
