import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, employeesTable, settingsTable } from "@workspace/db";
import { checkLicense } from "../lib/license";
import { z } from "zod/v4";

const router: IRouter = Router();

const LICENSE_KEY_DB = "licenseKey";
const TRIAL_STARTED_DB = "trialStartedAt";

async function getActiveKey(): Promise<string | undefined> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, LICENSE_KEY_DB))
    .limit(1);
  return rows[0]?.value ?? process.env.LICENSE_KEY ?? undefined;
}

async function getOrCreateTrialStart(): Promise<Date> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, TRIAL_STARTED_DB))
    .limit(1);

  if (rows[0]?.value) {
    return new Date(rows[0].value);
  }

  const now = new Date();
  await db
    .insert(settingsTable)
    .values({ key: TRIAL_STARTED_DB, value: now.toISOString() })
    .onConflictDoNothing();
  return now;
}

router.get("/license", async (_req, res): Promise<void> => {
  const key = await getActiveKey();
  if (!key) {
    const trialStartedAt = await getOrCreateTrialStart();
    res.json(checkLicense(undefined, trialStartedAt));
    return;
  }
  res.json(checkLicense(key));
});

const UpdateLicenseBody = z.object({
  key: z.string().nullable(),
});

router.put("/license", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.clerkUserId, auth.userId));

  if (!employee || employee.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = UpdateLicenseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const newKey = body.data.key;

  if (!newKey) {
    await db.delete(settingsTable).where(eq(settingsTable.key, LICENSE_KEY_DB));
  } else {
    await db
      .insert(settingsTable)
      .values({ key: LICENSE_KEY_DB, value: newKey })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: newKey, updatedAt: new Date() },
      });
  }

  const activeKey = newKey ?? process.env.LICENSE_KEY ?? undefined;
  res.json(checkLicense(activeKey));
});

export default router;
