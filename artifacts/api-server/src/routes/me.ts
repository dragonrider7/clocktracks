import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

  // 1. Try to find employee already linked by Clerk user ID
  let [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.clerkUserId, clerkUserId));

  // Sync imageUrl for already-linked users if it's not yet cached
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

  if (!employee) {
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch Clerk user");
      res.status(500).json({ error: "Failed to look up user" });
      return;
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    // 2. Try to match by email to an existing employee record
    if (email) {
      [employee] = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.email, email));

      if (employee) {
        // Link the Clerk user ID and sync imageUrl so future lookups skip this step
        [employee] = await db
          .update(employeesTable)
          .set({ clerkUserId, imageUrl: clerkUser.imageUrl ?? null })
          .where(eq(employeesTable.id, employee.id))
          .returning();
      }
    }

    // 3. No match found — check if this is the very first user ever (bootstrap admin)
    if (!employee) {
      const [{ count }] = await db
        .select({ count: db.$count(employeesTable) })
        .from(employeesTable);

      const isFirstUser = Number(count) === 0;

      if (isFirstUser) {
        // First account ever → create as admin so the system can be managed
        const name =
          clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : clerkUser.firstName || clerkUser.username || email || "Admin";

        [employee] = await db
          .insert(employeesTable)
          .values({ name, email: email ?? null, clerkUserId, role: "admin", imageUrl: clerkUser.imageUrl ?? null })
          .returning();
      } else {
        // Not the first user and no matching employee record → deny access
        res.status(403).json({ error: "not_authorized" });
        return;
      }
    }
  }

  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

export default router;
