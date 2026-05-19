import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, timeAdjustmentRequestsTable, employeesTable, timeEntriesTable, notificationsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreateTimeAdjustmentBody = z.object({
  employeeId: z.number().int(),
  timeEntryId: z.number().int().optional(),
  requestType: z.enum(["new", "edit", "delete"]),
  requestedDate: z.string().optional(),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
  reason: z.string().optional(),
});

const ReviewTimeAdjustmentBody = z.object({
  status: z.enum(["approved", "denied"]),
  reviewedBy: z.number().int(),
  adminNotes: z.string().optional(),
});

const ListQueryParams = z.object({
  employeeId: z.coerce.number().int().optional(),
  status: z.string().optional(),
});

async function notifyAdmins(db_: typeof db, title: string, message: string, relatedId: number, relatedType: string) {
  const admins = await db_.select().from(employeesTable).where(eq(employeesTable.role, "admin"));
  if (admins.length === 0) return;
  await db_.insert(notificationsTable).values(
    admins.map((admin) => ({
      recipientEmployeeId: admin.id,
      type: relatedType,
      title,
      message,
      relatedId,
      relatedType,
      read: false,
    }))
  );
}

function formatAdjustment(
  adj: typeof timeAdjustmentRequestsTable.$inferSelect,
  employeeName?: string | null,
  imageUrl?: string | null,
  reviewedByName?: string | null
) {
  return {
    ...adj,
    employeeName: employeeName ?? null,
    imageUrl: imageUrl ?? null,
    reviewedByName: reviewedByName ?? null,
    reviewedAt: adj.reviewedAt ? adj.reviewedAt.toISOString() : null,
    createdAt: adj.createdAt.toISOString(),
    updatedAt: adj.updatedAt.toISOString(),
  };
}

router.get("/time-adjustments", async (req, res): Promise<void> => {
  const query = ListQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.employeeId) {
    conditions.push(eq(timeAdjustmentRequestsTable.employeeId, query.data.employeeId));
  }
  if (query.data.status) {
    conditions.push(eq(timeAdjustmentRequestsTable.status, query.data.status));
  }

  const rows = await db
    .select({
      adj: timeAdjustmentRequestsTable,
      employeeName: employeesTable.name,
      imageUrl: employeesTable.imageUrl,
    })
    .from(timeAdjustmentRequestsTable)
    .leftJoin(employeesTable, eq(timeAdjustmentRequestsTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(timeAdjustmentRequestsTable.createdAt);

  const result = await Promise.all(
    rows.map(async ({ adj, employeeName, imageUrl }) => {
      let reviewedByName: string | null = null;
      if (adj.reviewedBy) {
        const [reviewer] = await db.select().from(employeesTable).where(eq(employeesTable.id, adj.reviewedBy));
        reviewedByName = reviewer?.name ?? null;
      }
      return formatAdjustment(adj, employeeName, imageUrl, reviewedByName);
    })
  );

  res.json(result);
});

router.post("/time-adjustments", async (req, res): Promise<void> => {
  const parsed = CreateTimeAdjustmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const [adj] = await db
    .insert(timeAdjustmentRequestsTable)
    .values({
      employeeId: parsed.data.employeeId,
      timeEntryId: parsed.data.timeEntryId ?? null,
      requestType: parsed.data.requestType,
      requestedDate: parsed.data.requestedDate ?? null,
      requestedClockIn: parsed.data.requestedClockIn ?? null,
      requestedClockOut: parsed.data.requestedClockOut ?? null,
      reason: parsed.data.reason ?? null,
      status: "pending",
    })
    .returning();

  const typeLabels: Record<"new" | "edit" | "delete", string> = { new: "add a new entry", edit: "correct an entry", delete: "remove an entry" };
  const typeLabel = typeLabels[parsed.data.requestType] ?? "adjust time";
  await notifyAdmins(
    db,
    "Time Adjustment Request",
    `${employee.name} requested to ${typeLabel}.`,
    adj.id,
    "time_adjustment"
  );

  res.status(201).json(formatAdjustment(adj, employee.name, employee.imageUrl, null));
});

router.patch("/time-adjustments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = ReviewTimeAdjustmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(timeAdjustmentRequestsTable).where(eq(timeAdjustmentRequestsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Adjustment request not found" });
    return;
  }

  const [updated] = await db
    .update(timeAdjustmentRequestsTable)
    .set({
      status: parsed.data.status,
      reviewedBy: parsed.data.reviewedBy,
      adminNotes: parsed.data.adminNotes ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(timeAdjustmentRequestsTable.id, id))
    .returning();

  if (parsed.data.status === "approved") {
    if (existing.requestType === "new") {
      const clockIn = existing.requestedClockIn ? new Date(existing.requestedClockIn) : new Date();
      const clockOut = existing.requestedClockOut ? new Date(existing.requestedClockOut) : null;
      await db.insert(timeEntriesTable).values({
        employeeId: existing.employeeId,
        clockIn,
        clockOut: clockOut ?? undefined,
        notes: existing.reason ?? null,
      });
    } else if (existing.requestType === "edit" && existing.timeEntryId) {
      const updates: Record<string, unknown> = {};
      if (existing.requestedClockIn) updates.clockIn = new Date(existing.requestedClockIn);
      if (existing.requestedClockOut) {
        updates.clockOut = new Date(existing.requestedClockOut);
        const inTime = existing.requestedClockIn ? new Date(existing.requestedClockIn) : null;
        if (inTime) {
          updates.totalMinutes = Math.round((new Date(existing.requestedClockOut).getTime() - inTime.getTime()) / 60000);
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(timeEntriesTable).set(updates).where(eq(timeEntriesTable.id, existing.timeEntryId));
      }
    } else if (existing.requestType === "delete" && existing.timeEntryId) {
      await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, existing.timeEntryId));
    }
  }

  const [reviewer] = parsed.data.reviewedBy
    ? await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.reviewedBy))
    : [null];
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, existing.employeeId));

  await db.insert(notificationsTable).values({
    recipientEmployeeId: existing.employeeId,
    type: "time_adjustment_review",
    title: `Time Adjustment ${parsed.data.status === "approved" ? "Approved" : "Denied"}`,
    message: `Your time adjustment request was ${parsed.data.status}${parsed.data.adminNotes ? `: ${parsed.data.adminNotes}` : "."}`,
    relatedId: id,
    relatedType: "time_adjustment",
    read: false,
  });

  res.json(formatAdjustment(updated, emp?.name ?? null, emp?.imageUrl ?? null, reviewer?.name ?? null));
});

export default router;
