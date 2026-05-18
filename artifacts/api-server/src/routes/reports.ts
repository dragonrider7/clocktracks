import { Router, type IRouter } from "express";
import { eq, gte, lte, and } from "drizzle-orm";
import { db, timeEntriesTable, employeesTable } from "@workspace/db";

const router: IRouter = Router();

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

export default router;
