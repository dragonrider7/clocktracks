import { Router, type IRouter } from "express";
import { eq, gte, lte, and } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable, timeOffRequestsTable } from "@workspace/db";

const router: IRouter = Router();

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

router.get("/reports/timesheets", async (req, res): Promise<void> => {
  const { startDate, endDate, employeeId } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const start = new Date(startDate as string);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate as string);
  end.setHours(23, 59, 59, 999);

  const conditions: ReturnType<typeof eq>[] = [
    gte(timeEntriesTable.clockIn, start) as ReturnType<typeof eq>,
    lte(timeEntriesTable.clockIn, end) as ReturnType<typeof eq>,
  ];

  if (employeeId) {
    conditions.push(eq(timeEntriesTable.employeeId, parseInt(employeeId as string)) as ReturnType<typeof eq>);
  }

  const rows = await db
    .select({
      entry: timeEntriesTable,
      employeeName: employeesTable.name,
      department: employeesTable.department,
    })
    .from(timeEntriesTable)
    .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
    .where(and(...conditions))
    .orderBy(timeEntriesTable.clockIn);

  const byEmployee = new Map<
    number,
    {
      employeeId: number;
      employeeName: string;
      department: string | null;
      totalMinutes: number;
      entries: object[];
    }
  >();

  for (const { entry, employeeName, department } of rows) {
    if (!byEmployee.has(entry.employeeId)) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        employeeName: employeeName ?? "Unknown",
        department: department ?? null,
        totalMinutes: 0,
        entries: [],
      });
    }
    const emp = byEmployee.get(entry.employeeId)!;

    let totalMinutes: number | null = null;
    if (entry.clockOut) {
      totalMinutes = Math.round(
        (entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000,
      );
      emp.totalMinutes += totalMinutes;
    }

    emp.entries.push({
      id: entry.id,
      employeeId: entry.employeeId,
      employeeName: employeeName ?? null,
      clockIn: entry.clockIn.toISOString(),
      clockOut: entry.clockOut?.toISOString() ?? null,
      notes: entry.notes ?? null,
      totalMinutes,
      createdAt: entry.createdAt.toISOString(),
    });
  }

  res.json(Array.from(byEmployee.values()));
});

router.get("/reports/time-off-balances", async (req, res): Promise<void> => {
  const { employeeId } = req.query;

  const [employees, requests] = await Promise.all([
    db.select().from(employeesTable).orderBy(employeesTable.name),
    db.select().from(timeOffRequestsTable),
  ]);

  const filtered = employeeId
    ? employees.filter((e) => e.id === parseInt(employeeId as string))
    : employees;

  const result = filtered.map((emp) => {
    const empReqs = requests.filter((r) => r.employeeId === emp.id);

    const usedHours = empReqs
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + calcDays(r.startDate, r.endDate) * 8, 0);

    const plannedHours = empReqs
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + calcDays(r.startDate, r.endDate) * 8, 0);

    const allottedHours = emp.timeOffAllotmentHours ?? 80;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department ?? null,
      allottedHours,
      usedHours,
      plannedHours,
      remainingHours: Math.max(0, allottedHours - usedHours),
      usedPlusPlannedHours: usedHours + plannedHours,
    };
  });

  res.json(result);
});

export default router;
