import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, holidaysTable } from "@workspace/db";
import { computeHolidayDate, recurrenceLabel } from "../utils/holiday-dates.js";

const router: IRouter = Router();

const US_HOLIDAYS: Omit<typeof holidaysTable.$inferInsert, "id" | "createdAt" | "updatedAt">[] = [
  { name: "New Year's Day",               hoursPerDay: 8, recurrenceType: "fixed",       recurrenceMonth: 1,  recurrenceDayOfMonth: 1,  recurrenceWeekday: null, recurrenceNth: null, date: null },
  { name: "Martin Luther King Jr. Day",   hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 1,  recurrenceDayOfMonth: null, recurrenceWeekday: 1, recurrenceNth: 3,  date: null },
  { name: "Presidents' Day",              hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 2,  recurrenceDayOfMonth: null, recurrenceWeekday: 1, recurrenceNth: 3,  date: null },
  { name: "Memorial Day",                 hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 5,  recurrenceDayOfMonth: null, recurrenceWeekday: 1, recurrenceNth: -1, date: null },
  { name: "Juneteenth",                   hoursPerDay: 8, recurrenceType: "fixed",       recurrenceMonth: 6,  recurrenceDayOfMonth: 19, recurrenceWeekday: null, recurrenceNth: null, date: null },
  { name: "Independence Day",             hoursPerDay: 8, recurrenceType: "fixed",       recurrenceMonth: 7,  recurrenceDayOfMonth: 4,  recurrenceWeekday: null, recurrenceNth: null, date: null },
  { name: "Labor Day",                    hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 9,  recurrenceDayOfMonth: null, recurrenceWeekday: 1, recurrenceNth: 1,  date: null },
  { name: "Columbus Day",                 hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 10, recurrenceDayOfMonth: null, recurrenceWeekday: 1, recurrenceNth: 2,  date: null },
  { name: "Veterans Day",                 hoursPerDay: 8, recurrenceType: "fixed",       recurrenceMonth: 11, recurrenceDayOfMonth: 11, recurrenceWeekday: null, recurrenceNth: null, date: null },
  { name: "Thanksgiving",                 hoursPerDay: 8, recurrenceType: "nth_weekday", recurrenceMonth: 11, recurrenceDayOfMonth: null, recurrenceWeekday: 4, recurrenceNth: 4,  date: null },
  { name: "Christmas Day",                hoursPerDay: 8, recurrenceType: "fixed",       recurrenceMonth: 12, recurrenceDayOfMonth: 25, recurrenceWeekday: null, recurrenceNth: null, date: null },
];

function fmt(h: typeof holidaysTable.$inferSelect) {
  const currentYear = new Date().getFullYear();
  const resolvedCurrentYear = computeHolidayDate(h, currentYear);
  return {
    ...h,
    resolvedCurrentYear,
    recurrenceLabel: recurrenceLabel(h),
    createdAt: h.createdAt.toISOString(),
  };
}

router.get("/holidays", async (_req, res): Promise<void> => {
  const holidays = await db
    .select()
    .from(holidaysTable)
    .orderBy(holidaysTable.name);
  res.json(holidays.map(fmt));
});

router.post("/holidays/seed", async (_req, res): Promise<void> => {
  const existing = await db.select({ name: holidaysTable.name }).from(holidaysTable);
  const existingNames = new Set(existing.map((h) => h.name));

  const toInsert = US_HOLIDAYS.filter((h) => !existingNames.has(h.name));

  if (toInsert.length > 0) {
    await db.insert(holidaysTable).values(toInsert);
  }

  res.json({ created: toInsert.length, skipped: US_HOLIDAYS.length - toInsert.length });
});

router.post("/holidays", async (req, res): Promise<void> => {
  const { name, hoursPerDay, recurrenceType, date, recurrenceMonth, recurrenceDayOfMonth, recurrenceWeekday, recurrenceNth } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const rt = (recurrenceType as string) || "none";

  if (rt === "none" && (!date || typeof date !== "string")) {
    res.status(400).json({ error: "date is required for one-time holidays" });
    return;
  }
  if (rt === "fixed" && (!recurrenceMonth || !recurrenceDayOfMonth)) {
    res.status(400).json({ error: "recurrenceMonth and recurrenceDayOfMonth are required for fixed recurrence" });
    return;
  }
  if (rt === "nth_weekday" && (recurrenceMonth == null || recurrenceWeekday == null || recurrenceNth == null)) {
    res.status(400).json({ error: "recurrenceMonth, recurrenceWeekday, and recurrenceNth are required for nth_weekday recurrence" });
    return;
  }

  const [holiday] = await db
    .insert(holidaysTable)
    .values({
      name: name.trim(),
      hoursPerDay: typeof hoursPerDay === "number" ? hoursPerDay : 8,
      recurrenceType: rt,
      date: rt === "none" ? (date as string) : null,
      recurrenceMonth: recurrenceMonth != null ? Number(recurrenceMonth) : null,
      recurrenceDayOfMonth: recurrenceDayOfMonth != null ? Number(recurrenceDayOfMonth) : null,
      recurrenceWeekday: recurrenceWeekday != null ? Number(recurrenceWeekday) : null,
      recurrenceNth: recurrenceNth != null ? Number(recurrenceNth) : null,
    })
    .returning();

  res.status(201).json(fmt(holiday));
});

router.patch("/holidays/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const { name, hoursPerDay, recurrenceType, date, recurrenceMonth, recurrenceDayOfMonth, recurrenceWeekday, recurrenceNth } = req.body as Record<string, unknown>;

  const patch: Partial<typeof holidaysTable.$inferInsert> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (hoursPerDay !== undefined) patch.hoursPerDay = Number(hoursPerDay);
  if (recurrenceType !== undefined) patch.recurrenceType = String(recurrenceType);
  if (date !== undefined) patch.date = date === null ? null : String(date);
  if (recurrenceMonth !== undefined) patch.recurrenceMonth = recurrenceMonth === null ? null : Number(recurrenceMonth);
  if (recurrenceDayOfMonth !== undefined) patch.recurrenceDayOfMonth = recurrenceDayOfMonth === null ? null : Number(recurrenceDayOfMonth);
  if (recurrenceWeekday !== undefined) patch.recurrenceWeekday = recurrenceWeekday === null ? null : Number(recurrenceWeekday);
  if (recurrenceNth !== undefined) patch.recurrenceNth = recurrenceNth === null ? null : Number(recurrenceNth);

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "no fields to update" });
    return;
  }

  const [holiday] = await db
    .update(holidaysTable)
    .set(patch)
    .where(eq(holidaysTable.id, id))
    .returning();

  if (!holiday) { res.status(404).json({ error: "Holiday not found" }); return; }
  res.json(fmt(holiday));
});

router.delete("/holidays/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const [holiday] = await db
    .delete(holidaysTable)
    .where(eq(holidaysTable.id, id))
    .returning();

  if (!holiday) { res.status(404).json({ error: "Holiday not found" }); return; }
  res.sendStatus(204);
});

export default router;
