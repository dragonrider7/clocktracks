import { Router, type IRouter } from "express";
import { eq, isNull, and, gte, lte, isNotNull } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/current-status", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const [allEmployees, clockedInEntries, todayEntries] = await Promise.all([
    db.select().from(employeesTable),
    db
      .select({ entry: timeEntriesTable, employeeName: employeesTable.name, department: employeesTable.department })
      .from(timeEntriesTable)
      .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(isNull(timeEntriesTable.clockOut)),
    db
      .select()
      .from(timeEntriesTable)
      .where(
        and(
          gte(timeEntriesTable.clockIn, todayStart),
          lte(timeEntriesTable.clockIn, todayEnd),
          isNotNull(timeEntriesTable.clockOut)
        )
      ),
  ]);

  let todayTotalMinutes = 0;
  for (const entry of todayEntries) {
    if (entry.clockOut) {
      todayTotalMinutes += Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000);
    }
  }

  res.json({
    clockedInCount: clockedInEntries.length,
    totalEmployees: allEmployees.length,
    todayTotalHours: Math.round((todayTotalMinutes / 60) * 10) / 10,
    clockedInEmployees: clockedInEntries.map(({ entry, employeeName, department }) => ({
      employeeId: entry.employeeId,
      employeeName: employeeName ?? "Unknown",
      department: department ?? null,
      clockIn: entry.clockIn.toISOString(),
      timeEntryId: entry.id,
    })),
  });
});

router.get("/dashboard/weekly-hours", async (_req, res): Promise<void> => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const entries = await db
    .select({
      entry: timeEntriesTable,
      employeeName: employeesTable.name,
      department: employeesTable.department,
    })
    .from(timeEntriesTable)
    .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
    .where(
      and(
        gte(timeEntriesTable.clockIn, monday),
        lte(timeEntriesTable.clockIn, sunday)
      )
    );

  const byEmployee = new Map<
    number,
    { employeeId: number; employeeName: string; department: string | null; totalMinutes: number; days: Set<string> }
  >();

  for (const { entry, employeeName, department } of entries) {
    if (!byEmployee.has(entry.employeeId)) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        employeeName: employeeName ?? "Unknown",
        department: department ?? null,
        totalMinutes: 0,
        days: new Set(),
      });
    }
    const emp = byEmployee.get(entry.employeeId)!;
    if (entry.clockOut) {
      emp.totalMinutes += Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000);
    }
    emp.days.add(entry.clockIn.toISOString().split("T")[0]);
  }

  const result = Array.from(byEmployee.values()).map((e) => ({
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    department: e.department,
    totalMinutes: e.totalMinutes,
    daysWorked: e.days.size,
  }));

  res.json(result);
});

router.get("/dashboard/pending-requests", async (_req, res): Promise<void> => {
  const { timeOffRequestsTable } = await import("@workspace/db");
  const requests = await db.select().from(timeOffRequestsTable).where(eq(timeOffRequestsTable.status, "pending"));
  res.json({ count: requests.length });
});

router.get("/dashboard/out-this-week", async (_req, res): Promise<void> => {
  const { timeOffRequestsTable } = await import("@workspace/db");
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = monday.toISOString().split("T")[0];
  const sundayStr = sunday.toISOString().split("T")[0];

  const rows = await db
    .select({
      req: timeOffRequestsTable,
      employeeName: employeesTable.name,
      department: employeesTable.department,
    })
    .from(timeOffRequestsTable)
    .leftJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
    .where(
      and(
        eq(timeOffRequestsTable.status, "approved"),
        lte(timeOffRequestsTable.startDate, sundayStr),
        gte(timeOffRequestsTable.endDate, mondayStr),
      ),
    );

  res.json(
    rows.map(({ req, employeeName, department }) => ({
      requestId: req.id,
      employeeId: req.employeeId,
      employeeName: employeeName ?? "Unknown",
      department: department ?? null,
      type: req.type,
      startDate: req.startDate,
      endDate: req.endDate,
    })),
  );
});

export default router;
