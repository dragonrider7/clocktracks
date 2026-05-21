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
    kind: entry.kind ?? "work",
    timeOffType: entry.timeOffType ?? null,
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

  const kind = parsed.data.kind ?? "work";

  if (kind === "time_off") {
    const startDateStr = parsed.data.startDate;
    const endDateStr = parsed.data.endDate ?? parsed.data.startDate;
    if (!startDateStr) {
      res.status(400).json({ error: "startDate is required for time_off entries" });
      return;
    }
    const timeOffType = parsed.data.timeOffType ?? null;
    const hoursPerDay = parsed.data.hoursPerDay ?? 8;
    const notes = parsed.data.notes ?? null;

    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date((endDateStr ?? startDateStr) + "T00:00:00");

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      res.status(400).json({ error: "Invalid date range" });
      return;
    }

    const toInsert: (typeof timeEntriesTable.$inferInsert)[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const clockIn = new Date(cursor);
      clockIn.setHours(0, 0, 0, 0);
      const clockOut = new Date(cursor);
      clockOut.setHours(0, hoursPerDay * 60, 0, 0);

      toInsert.push({
        employeeId: parsed.data.employeeId,
        kind: "time_off",
        timeOffType,
        clockIn,
        clockOut,
        notes,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    const inserted = await db.insert(timeEntriesTable).values(toInsert).returning();
    res.status(201).json(inserted.map((e) => formatEntry(e, employee.name)));
    return;
  }

  // kind === "work"
  if (!parsed.data.clockIn) {
    res.status(400).json({ error: "clockIn is required for work entries" });
    return;
  }

  const [entry] = await db
    .insert(timeEntriesTable)
    .values({
      employeeId: parsed.data.employeeId,
      kind: "work",
      timeOffType: null,
      clockIn: new Date(parsed.data.clockIn),
      clockOut: parsed.data.clockOut ? new Date(parsed.data.clockOut) : null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  res.status(201).json([formatEntry(entry, employee.name)]);
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
      kind: "work",
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
  if (parsed.data.kind) updates.kind = parsed.data.kind;
  if ("timeOffType" in parsed.data) updates.timeOffType = parsed.data.timeOffType ?? null;
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
