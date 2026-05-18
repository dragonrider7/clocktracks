import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date"),
  hoursPerDay: integer("hours_per_day").notNull().default(8),
  recurrenceType: text("recurrence_type").notNull().default("none"),
  recurrenceMonth: integer("recurrence_month"),
  recurrenceDayOfMonth: integer("recurrence_day_of_month"),
  recurrenceWeekday: integer("recurrence_weekday"),
  recurrenceNth: integer("recurrence_nth"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
