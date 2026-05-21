import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, employeesTable, settingsTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  GetEmployeeParams,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { checkLicense } from "../lib/license";

const router: IRouter = Router();

router.get("/employees", async (req, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
  res.json(employees.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // ── License seat check ────────────────────────────────────────────────────
  const licenseRows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "licenseKey"))
    .limit(1);
  const licenseKey = licenseRows[0]?.value ?? process.env.LICENSE_KEY;
  const license = checkLicense(licenseKey);

  if (license.maxEmployees !== null) {
    const [{ count }] = await db
      .select({ count: db.$count(employeesTable) })
      .from(employeesTable);
    if (Number(count) >= license.maxEmployees) {
      res.status(422).json({
        error: "employee_limit_reached",
        maxEmployees: license.maxEmployees,
        message: `Your license allows up to ${license.maxEmployees} employees. Please upgrade to add more.`,
      });
      return;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [employee] = await db.insert(employeesTable).values(parsed.data).returning();
  res.status(201).json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [employee] = await db
    .update(employeesTable)
    .set(parsed.data)
    .where(eq(employeesTable.id, params.data.id))
    .returning();
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json({ ...employee, createdAt: employee.createdAt.toISOString() });
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [employee] = await db.delete(employeesTable).where(eq(employeesTable.id, params.data.id)).returning();
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
