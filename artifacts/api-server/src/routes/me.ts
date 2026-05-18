import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
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

  // Try to find employee by clerkUserId
  let [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.clerkUserId, clerkUserId));

  if (!employee) {
    // Try to find by email using Clerk user data
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;

      if (email) {
        [employee] = await db
          .select()
          .from(employeesTable)
          .where(eq(employeesTable.email, email));

        if (employee) {
          // Link the Clerk user to this employee record
          [employee] = await db
            .update(employeesTable)
            .set({ clerkUserId })
            .where(eq(employeesTable.id, employee.id))
            .returning();
        }
      }

      if (!employee) {
        // JIT provision a new employee record
        const name =
          clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : clerkUser.firstName || clerkUser.username || email || "Unknown";

        // Check if this is the first user — make them admin
        const existing = await db.select().from(employeesTable);
        const isFirstUser = existing.length === 0;

        [employee] = await db
          .insert(employeesTable)
          .values({
            name,
            email: email || null,
            clerkUserId,
            role: isFirstUser ? "admin" : "employee",
          })
          .returning();
      }
    } catch (err) {
      req.log.error({ err }, "Failed to fetch Clerk user");
      res.status(500).json({ error: "Failed to provision user" });
      return;
    }
  }

  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

export default router;
