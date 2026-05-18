import { Router, type IRouter } from "express";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable } from "@workspace/db";
import {
  ListTimeEntriesQueryParams,
  ClockInBody,
  ClockOutParams,
  ClockOutBody,
  UpdateTimeEntryParams,
  UpdateTimeEntryBody,
  DeleteTimeEntryParams,
  CreateTimeEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatEntry(entry: typeof timeEntriesTable.$inferSelect, employeeName?: string | null) {
  const totalMinutes =
    entry.clockOut
      ? Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000)
      : null;
  return {
    ...entry,
    employeeName: employeeName ?? null,
    clockIn: entry.clockIn.toISOString(),
    clockOut: entry.clockOut ? entry.clockOut.toISOString() : null,
    totalMinutes,
    createdAt: entry.createdAt.toISOString(),
  };
}

router.get("/time-entries", async (req, res): Promise<void> => {
  const query = ListTimeEntriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.employeeId) {
    conditions.push(eq(timeEntriesTable.employeeId, query.data.employeeId));
  }
  if (query.data.startDate) {
    conditions.push(gte(timeEntriesTable.clockIn, new Date(query.data.startDate)));
  }
  if (query.data.endDate) {
    const end = new Date(query.data.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(timeEntriesTable.clockIn, end));
  }

  const entries = await db
    .select({
      entry: timeEntriesTable,
      employeeName: employeesTable.name,
    })
    .from(timeEntriesTable)
    .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(timeEntriesTable.clockIn);

  res.json(entries.map(({ entry, employeeName }) => formatEntry(entry, employeeName)));
});

router.post("/time-entries", async (req, res): Promise<void> => {
  const parsed = CreateTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const [entry] = await db
    .insert(timeEntriesTable)
    .values({
      employeeId: parsed.data.employeeId,
      clockIn: new Date(parsed.data.clockIn),
      clockOut: parsed.data.clockOut ? new Date(parsed.data.clockOut) : null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(formatEntry(entry, employee.name));
});

router.post("/time-entries/clock-in", async (req, res): Promise<void> => {
  const parsed = ClockInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(timeEntriesTable)
    .where(
      and(
        eq(timeEntriesTable.employeeId, parsed.data.employeeId),
        isNull(timeEntriesTable.clockOut)
      )
    );

  if (existing.length > 0) {
    res.status(400).json({ error: "Employee is already clocked in" });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const [entry] = await db
    .insert(timeEntriesTable)
    .values({
      employeeId: parsed.data.employeeId,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json(formatEntry(entry, employee.name));
});

router.patch("/time-entries/:id/clock-out", async (req, res): Promise<void> => {
  const params = ClockOutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ClockOutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }
  if (existing.clockOut) {
    res.status(400).json({ error: "Already clocked out" });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, existing.employeeId));

  const updates: Partial<typeof timeEntriesTable.$inferInsert> = {
    clockOut: new Date(),
  };
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [entry] = await db
    .update(timeEntriesTable)
    .set(updates)
    .where(eq(timeEntriesTable.id, params.data.id))
    .returning();

  res.json(formatEntry(entry, employee?.name ?? null));
});

router.patch("/time-entries/:id", async (req, res): Promise<void> => {
  const params = UpdateTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.clockIn) updates.clockIn = new Date(parsed.data.clockIn);
  if (parsed.data.clockOut) updates.clockOut = new Date(parsed.data.clockOut);
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;

  const [entry] = await db
    .update(timeEntriesTable)
    .set(updates)
    .where(eq(timeEntriesTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, entry.employeeId));
  res.json(formatEntry(entry, employee?.name ?? null));
});

router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  const params = DeleteTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, params.data.id)).returning();
  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
