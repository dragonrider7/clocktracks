import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";

const SUPER_ADMIN_USERNAME = "clocktracksadmin";
const SUPER_ADMIN_PASSWORD = "#sehVivrEwd$inet6rR9VzpawoBZ@u64";
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

const router: IRouter = Router();

router.post("/superadmin/login", (req, res): void => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
    // httpOnly signed cookie — the actual auth token
    res.cookie("_ctsa_s", "1", {
      httpOnly: true,
      signed: true,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    // Readable flag cookie — lets the frontend detect ghost mode without a round-trip
    res.cookie("_ctsa", "1", {
      httpOnly: false,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    res.json({ ok: true });
    return;
  }

  res.status(401).json({ error: "Invalid credentials" });
});

router.post("/superadmin/logout", (_req, res): void => {
  res.clearCookie("_ctsa_s", { path: "/" });
  res.clearCookie("_ctsa", { path: "/" });
  res.json({ ok: true });
});

/**
 * Manually link a Clerk user ID to an employee record.
 * Ghost-admin only — requires the signed _ctsa_s cookie.
 * Useful when email matching fails (e.g. employee signed up with a different
 * email than what was entered in the admin panel).
 *
 * Body: { employeeId: number, clerkUserId: string }
 * To find a Clerk user ID: Clerk Dashboard → Users → click the user → copy "User ID"
 */
router.post("/superadmin/link-clerk", async (req, res): Promise<void> => {
  const signedCookies = (req as unknown as { signedCookies: Record<string, string> }).signedCookies;
  if (signedCookies?.["_ctsa_s"] !== "1") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { employeeId, clerkUserId } = req.body as { employeeId?: unknown; clerkUserId?: unknown };

  if (typeof employeeId !== "number" || !Number.isInteger(employeeId) || employeeId <= 0) {
    res.status(400).json({ error: "employeeId must be a positive integer" });
    return;
  }
  if (typeof clerkUserId !== "string" || !clerkUserId.trim()) {
    res.status(400).json({ error: "clerkUserId must be a non-empty string" });
    return;
  }

  const [employee] = await db
    .update(employeesTable)
    .set({ clerkUserId: clerkUserId.trim() })
    .where(eq(employeesTable.id, employeeId))
    .returning();

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json({ ok: true, employee });
});

/**
 * Clear the Clerk user ID link for an employee (unlink).
 * Ghost-admin only.
 *
 * Body: { employeeId: number }
 */
router.post("/superadmin/unlink-clerk", async (req, res): Promise<void> => {
  const signedCookies = (req as unknown as { signedCookies: Record<string, string> }).signedCookies;
  if (signedCookies?.["_ctsa_s"] !== "1") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { employeeId } = req.body as { employeeId?: unknown };
  if (typeof employeeId !== "number" || !Number.isInteger(employeeId) || employeeId <= 0) {
    res.status(400).json({ error: "employeeId must be a positive integer" });
    return;
  }

  const [employee] = await db
    .update(employeesTable)
    .set({ clerkUserId: null })
    .where(eq(employeesTable.id, employeeId))
    .returning();

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json({ ok: true, employee });
});

export default router;
