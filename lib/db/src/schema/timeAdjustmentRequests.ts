import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timeAdjustmentRequestsTable = pgTable("time_adjustment_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  timeEntryId: integer("time_entry_id"),
  requestType: text("request_type").notNull().default("edit"),
  requestedDate: text("requested_date"),
  requestedClockIn: text("requested_clock_in"),
  requestedClockOut: text("requested_clock_out"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTimeAdjustmentRequestSchema = createInsertSchema(timeAdjustmentRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimeAdjustmentRequest = z.infer<typeof insertTimeAdjustmentRequestSchema>;
export type TimeAdjustmentRequest = typeof timeAdjustmentRequestsTable.$inferSelect;
