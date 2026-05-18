import { Router, type IRouter } from "express";
import { eq, gte, lte, and, or } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable, timeOffRequestsTable, holidaysTable } from "@workspace/db";

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
  const reportStartStr = dateStr(start);
  const reportEndStr = dateStr(end);

  const entryConditions: ReturnType<typeof eq>[] = [
    gte(timeEntriesTable.clockIn, start) as ReturnType<typeof eq>,
    lte(timeEntriesTable.clockIn, end) as ReturnType<typeof eq>,
  ];
  if (empIdFilter) {
    entryConditions.push(eq(timeEntriesTable.employeeId, empIdFilter) as ReturnType<typeof eq>);
  }

  const [rows, allEmployees, allTimeOff, holidays] = await Promise.all([
    db
      .select({ entry: timeEntriesTable, employeeName: employeesTable.name, department: employeesTable.department })
      .from(timeEntriesTable)
      .leftJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(...entryConditions))
      .orderBy(timeEntriesTable.clockIn),
    empIdFilter
      ? db.select().from(employeesTable).where(eq(employeesTable.id, empIdFilter))
      : db.select().from(employeesTable).orderBy(employeesTable.name),
    db
      .select({ req: timeOffRequestsTable, employeeName: employeesTable.name, department: employeesTable.department })
      .from(timeOffRequestsTable)
      .leftJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
      .where(
        and(
          eq(timeOffRequestsTable.status, "approved"),
          or(
            and(
              gte(timeOffRequestsTable.startDate, reportStartStr),
              lte(timeOffRequestsTable.startDate, reportEndStr)
            ) as ReturnType<typeof eq>,
            and(
              gte(timeOffRequestsTable.endDate, reportStartStr),
              lte(timeOffRequestsTable.endDate, reportEndStr)
            ) as ReturnType<typeof eq>,
            and(
              lte(timeOffRequestsTable.startDate, reportStartStr),
              gte(timeOffRequestsTable.endDate, reportEndStr)
            ) as ReturnType<typeof eq>
          ) as ReturnType<typeof eq>
        )
      ),
    db
      .select()
      .from(holidaysTable)
      .where(
        and(
          gte(holidaysTable.date, reportStartStr),
          lte(holidaysTable.date, reportEndStr)
        )
      )
      .orderBy(holidaysTable.date),
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

  const ensureEmployee = (id: number, name: string, dept: string | null) => {
    if (!byEmployee.has(id)) {
      byEmployee.set(id, {
        employeeId: id,
        employeeName: name,
        department: dept,
        totalMinutes: 0,
        totalTimeOffMinutes: 0,
        entries: [],
      });
    }
    return byEmployee.get(id)!;
  };

  // Seed all employees (so holidays appear for everyone)
  for (const emp of allEmployees) {
    ensureEmployee(emp.id, emp.name, emp.department ?? null);
  }

  // Work entries
  for (const { entry, employeeName, department } of rows) {
    const emp = ensureEmployee(entry.employeeId, employeeName ?? "Unknown", department ?? null);
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

  // Approved time-off entries (one per overlapping calendar day)
  for (const { req: tor, employeeName, department } of allTimeOff) {
    if (empIdFilter && tor.employeeId !== empIdFilter) continue;
    const effStart = tor.startDate < reportStartStr ? reportStartStr : tor.startDate;
    const effEnd = tor.endDate > reportEndStr ? reportEndStr : tor.endDate;
    const days = calcDays(effStart, effEnd);
    const emp = ensureEmployee(tor.employeeId, employeeName ?? "Unknown", department ?? null);

    for (let i = 0; i < days; i++) {
      const d = new Date(effStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      emp.totalTimeOffMinutes += 480;
      emp.entries.push({
        kind: "time_off",
        id: null,
        employeeId: tor.employeeId,
        employeeName: employeeName ?? null,
        date: dateStr(d),
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

  // Company holidays — one entry per employee per holiday day
  for (const holiday of holidays) {
    for (const emp of byEmployee.values()) {
      const mins = holiday.hoursPerDay * 60;
      emp.totalTimeOffMinutes += mins;
      emp.entries.push({
        kind: "time_off",
        id: holiday.id,
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        date: holiday.date,
        clockIn: null,
        clockOut: null,
        totalMinutes: mins,
        notes: holiday.name,
        createdAt: null,
        timeOffType: "holiday",
        timeOffRequestId: null,
      });
    }
  }

  // Sort each employee's entries by date, work entries before time-off on same day
  for (const emp of byEmployee.values()) {
    emp.entries.sort((a, b) => {
      const da = a.date ?? a.clockIn ?? "";
      const db2 = b.date ?? b.clockIn ?? "";
      if (da !== db2) return da.localeCompare(db2);
      if (a.kind === "work" && b.kind !== "work") return -1;
      if (a.kind !== "work" && b.kind === "work") return 1;
      return 0;
    });
  }

  // Remove employees with no entries at all (only if filtering was active and they have nothing)
  const result = Array.from(byEmployee.values())
    .filter((e) => e.entries.length > 0)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  res.json(result);
});

router.get("/reports/time-off-balances", async (req, res): Promise<void> => {
  const { employeeId, year } = req.query;
  const yearNum = year ? parseInt(year as string) : new Date().getFullYear();
  const yearStart = `${yearNum}-01-01`;
  const yearEnd = `${yearNum}-12-31`;

  const [employees, requests] = await Promise.all([
    db.select().from(employeesTable).orderBy(employeesTable.name),
    db
      .select()
      .from(timeOffRequestsTable)
      .where(
        and(
          gte(timeOffRequestsTable.startDate, yearStart),
          lte(timeOffRequestsTable.startDate, yearEnd)
        )
      ),
  ]);

  const filtered = employeeId
    ? employees.filter((e) => e.id === parseInt(employeeId as string))
    : employees;

  const result = filtered.map((emp) => {
    const empReqs = requests
      .filter((r) => r.employeeId === emp.id && r.status !== "denied")
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const breakdownMap: Record<string, { usedHours: number; plannedHours: number }> = {};
    let usedHours = 0;
    let plannedHours = 0;

    for (const r of empReqs) {
      const hours = calcDays(r.startDate, r.endDate) * 8;
      if (!breakdownMap[r.type]) breakdownMap[r.type] = { usedHours: 0, plannedHours: 0 };
      if (r.status === "approved") {
        breakdownMap[r.type].usedHours += hours;
        usedHours += hours;
      } else if (r.status === "pending") {
        breakdownMap[r.type].plannedHours += hours;
        plannedHours += hours;
      }
    }

    const breakdown = Object.entries(breakdownMap).map(([type, b]) => ({
      type,
      usedHours: b.usedHours,
      plannedHours: b.plannedHours,
      totalHours: b.usedHours + b.plannedHours,
    }));

    const requestSummaries = empReqs.map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      type: r.type,
      days: calcDays(r.startDate, r.endDate),
      hours: calcDays(r.startDate, r.endDate) * 8,
      status: r.status,
      notes: r.notes ?? null,
    }));

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
      year: yearNum,
      breakdown,
      requests: requestSummaries,
    };
  });

  res.json(result);
});

export default router;
