import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, holidaysTable } from "@workspace/db";
import {
  CreateHolidayBody,
  UpdateHolidayParams,
  UpdateHolidayBody,
  DeleteHolidayParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(h: typeof holidaysTable.$inferSelect) {
  return { ...h, createdAt: h.createdAt.toISOString() };
}

router.get("/holidays", async (_req, res): Promise<void> => {
  const holidays = await db
    .select()
    .from(holidaysTable)
    .orderBy(holidaysTable.date);
  res.json(holidays.map(fmt));
});

router.post("/holidays", async (req, res): Promise<void> => {
  const parsed = CreateHolidayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [holiday] = await db
    .insert(holidaysTable)
    .values({
      name: parsed.data.name,
      date: parsed.data.date,
      hoursPerDay: parsed.data.hoursPerDay ?? 8,
    })
    .returning();
  res.status(201).json(fmt(holiday));
});

router.patch("/holidays/:id", async (req, res): Promise<void> => {
  const params = UpdateHolidayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHolidayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [holiday] = await db
    .update(holidaysTable)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
      ...(parsed.data.hoursPerDay !== undefined ? { hoursPerDay: parsed.data.hoursPerDay } : {}),
    })
    .where(eq(holidaysTable.id, params.data.id))
    .returning();
  if (!holiday) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  res.json(fmt(holiday));
});

router.delete("/holidays/:id", async (req, res): Promise<void> => {
  const params = DeleteHolidayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [holiday] = await db
    .delete(holidaysTable)
    .where(eq(holidaysTable.id, params.data.id))
    .returning();
  if (!holiday) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
