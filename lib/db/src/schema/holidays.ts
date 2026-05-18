import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  hoursPerDay: integer("hours_per_day").notNull().default(8),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
