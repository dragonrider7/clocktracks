import { Router, type IRouter } from "express";
import { eq, gte, lte, and, or } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable, timeOffRequestsTable } from "@workspace/db";

const router: IRouter = Router();

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
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

  const empIdFilter = employeeId ? parseInt(employeeId as string) : null;

  const entryConditions: ReturnType<typeof eq>[] = [
    gte(timeEntriesTable.clockIn, start) as ReturnType<typeof eq>,
    lte(timeEntriesTable.clockIn, end) as ReturnType<typeof eq>,
  ];
  if (empIdFilter) {
    entryConditions.push(eq(timeEntriesTable.employeeId, empIdFilter) as ReturnType<typeof eq>);
  }

  const [rows, employees, allTimeOff] = await Promise.all([
    db
      .select({ entry: timeEntriesTable, employeeName: employeesTable.name, department: employeesTable.department })
      .from(timeEntriesTable)
      .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(...entryConditions))
      .orderBy(timeEntriesTable.clockIn),
    db.select().from(employeesTable).orderBy(employeesTable.name),
    db
      .select({ req: timeOffRequestsTable, employeeName: employeesTable.name, department: employeesTable.department })
      .from(timeOffRequestsTable)
      .leftJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
      .where(
        and(
          eq(timeOffRequestsTable.status, "approved"),
          or(
            and(
              gte(timeOffRequestsTable.startDate, dateStr(start)),
              lte(timeOffRequestsTable.startDate, dateStr(end))
            ) as ReturnType<typeof eq>,
            and(
              gte(timeOffRequestsTable.endDate, dateStr(start)),
              lte(timeOffRequestsTable.endDate, dateStr(end))
            ) as ReturnType<typeof eq>,
            and(
              lte(timeOffRequestsTable.startDate, dateStr(start)),
              gte(timeOffRequestsTable.endDate, dateStr(end))
            ) as ReturnType<typeof eq>
          ) as ReturnType<typeof eq>
        )
      ),
  ]);

  type TimesheetEntry = {
    kind: "work" | "time_off";
    id: number | null;
    employeeId: number;
    employeeName: string | null;
    date: string | null;
    clockIn: string | null;
    clockOut: string | null;
    totalMinutes: number | null;
    notes: string | null;
    createdAt: string | null;
    timeOffType: string | null;
    timeOffRequestId: number | null;
  };

  type EmployeeSheet = {
    employeeId: number;
    employeeName: string;
    department: string | null;
    totalMinutes: number;
    totalTimeOffMinutes: number;
    entries: TimesheetEntry[];
  };

  const byEmployee = new Map<number, EmployeeSheet>();

  // Seed all employees that have work entries
  for (const { entry, employeeName, department } of rows) {
    if (!byEmployee.has(entry.employeeId)) {
      byEmployee.set(entry.employeeId, {
        employeeId: entry.employeeId,
        employeeName: employeeName ?? "Unknown",
        department: department ?? null,
        totalMinutes: 0,
        totalTimeOffMinutes: 0,
        entries: [],
      });
    }
    const emp = byEmployee.get(entry.employeeId)!;

    let totalMinutes: number | null = null;
    if (entry.clockOut) {
      totalMinutes = Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000);
      emp.totalMinutes += totalMinutes;
    }

    emp.entries.push({
      kind: "work",
      id: entry.id,
      employeeId: entry.employeeId,
      employeeName: employeeName ?? null,
      date: dateStr(entry.clockIn),
      clockIn: entry.clockIn.toISOString(),
      clockOut: entry.clockOut?.toISOString() ?? null,
      totalMinutes,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt.toISOString(),
      timeOffType: null,
      timeOffRequestId: null,
    });
  }

  // Add approved time-off entries — one entry per overlapping calendar day
  const reportStartStr = dateStr(start);
  const reportEndStr = dateStr(end);

  for (const { req: tor, employeeName, department } of allTimeOff) {
    if (empIdFilter && tor.employeeId !== empIdFilter) continue;

    // Clamp to report period
    const effStart = tor.startDate < reportStartStr ? reportStartStr : tor.startDate;
    const effEnd = tor.endDate > reportEndStr ? reportEndStr : tor.endDate;

    const days = calcDays(effStart, effEnd);

    if (!byEmployee.has(tor.employeeId)) {
      byEmployee.set(tor.employeeId, {
        employeeId: tor.employeeId,
        employeeName: employeeName ?? "Unknown",
        department: department ?? null,
        totalMinutes: 0,
        totalTimeOffMinutes: 0,
        entries: [],
      });
    }
    const emp = byEmployee.get(tor.employeeId)!;

    // One entry per day
    for (let i = 0; i < days; i++) {
      const d = new Date(effStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      const dayStr = dateStr(d);

      emp.totalTimeOffMinutes += 480; // 8h per day
      emp.entries.push({
        kind: "time_off",
        id: null,
        employeeId: tor.employeeId,
        employeeName: employeeName ?? null,
        date: dayStr,
        clockIn: null,
        clockOut: null,
        totalMinutes: 480,
        notes: tor.notes ?? null,
        createdAt: null,
        timeOffType: tor.type,
        timeOffRequestId: tor.id,
      });
    }
  }

  // Sort each employee's entries by date
  for (const emp of byEmployee.values()) {
    emp.entries.sort((a, b) => {
      const da = a.date ?? a.clockIn ?? "";
      const db2 = b.date ?? b.clockIn ?? "";
      return da.localeCompare(db2);
    });
  }

  res.json(
    Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  );
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
