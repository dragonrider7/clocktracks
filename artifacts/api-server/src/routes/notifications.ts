import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const EmployeeIdQuery = z.object({
  employeeId: z.coerce.number().int(),
});

router.get("/notifications", async (req, res): Promise<void> => {
  const query = EmployeeIdQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.recipientEmployeeId, query.data.employeeId))
    .orderBy(notificationsTable.createdAt);

  res.json(
    rows.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }))
  );
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const query = EmployeeIdQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.recipientEmployeeId, query.data.employeeId),
        eq(notificationsTable.read, false)
      )
    );

  res.json({ count: rows.length });
});

router.patch("/notifications/mark-all-read", async (req, res): Promise<void> => {
  const parsed = z.object({ employeeId: z.number().int() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.recipientEmployeeId, parsed.data.employeeId),
        eq(notificationsTable.read, false)
      )
    );

  res.json({ count: 0 });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

export default router;
