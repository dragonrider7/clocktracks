import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, timeOffRequestsTable, employeesTable } from "@workspace/db";
import {
  ListTimeOffRequestsQueryParams,
  CreateTimeOffRequestBody,
  GetTimeOffRequestParams,
  DeleteTimeOffRequestParams,
  ReviewTimeOffRequestParams,
  ReviewTimeOffRequestBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatRequest(
  req: typeof timeOffRequestsTable.$inferSelect,
  employeeName?: string | null,
  reviewedByName?: string | null
) {
  return {
    ...req,
    employeeName: employeeName ?? null,
    reviewedByName: reviewedByName ?? null,
    reviewedAt: req.reviewedAt ? req.reviewedAt.toISOString() : null,
    createdAt: req.createdAt.toISOString(),
  };
}

router.get("/time-off-requests", async (req, res): Promise<void> => {
  const query = ListTimeOffRequestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.employeeId) {
    conditions.push(eq(timeOffRequestsTable.employeeId, query.data.employeeId));
  }
  if (query.data.status) {
    conditions.push(eq(timeOffRequestsTable.status, query.data.status));
  }

  const requests = await db
    .select({
      request: timeOffRequestsTable,
      employeeName: employeesTable.name,
    })
    .from(timeOffRequestsTable)
    .leftJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(timeOffRequestsTable.createdAt);

  const result = await Promise.all(
    requests.map(async ({ request, employeeName }) => {
      let reviewedByName: string | null = null;
      if (request.reviewedBy) {
        const [reviewer] = await db.select().from(employeesTable).where(eq(employeesTable.id, request.reviewedBy));
        reviewedByName = reviewer?.name ?? null;
      }
      return formatRequest(request, employeeName, reviewedByName);
    })
  );

  res.json(result);
});

router.post("/time-off-requests", async (req, res): Promise<void> => {
  const parsed = CreateTimeOffRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  if (!employee) {
    res.status(400).json({ error: "Employee not found" });
    return;
  }

  const [request] = await db
    .insert(timeOffRequestsTable)
    .values({
      employeeId: parsed.data.employeeId,
      type: parsed.data.type,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      notes: parsed.data.notes ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(formatRequest(request, employee.name, null));
});

router.get("/time-off-requests/:id", async (req, res): Promise<void> => {
  const params = GetTimeOffRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db
    .select({ request: timeOffRequestsTable, employeeName: employeesTable.name })
    .from(timeOffRequestsTable)
    .leftJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
    .where(eq(timeOffRequestsTable.id, params.data.id));

  if (!result) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  let reviewedByName: string | null = null;
  if (result.request.reviewedBy) {
    const [reviewer] = await db.select().from(employeesTable).where(eq(employeesTable.id, result.request.reviewedBy));
    reviewedByName = reviewer?.name ?? null;
  }

  res.json(formatRequest(result.request, result.employeeName, reviewedByName));
});

router.delete("/time-off-requests/:id", async (req, res): Promise<void> => {
  const params = DeleteTimeOffRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [request] = await db.delete(timeOffRequestsTable).where(eq(timeOffRequestsTable.id, params.data.id)).returning();
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/time-off-requests/:id/review", async (req, res): Promise<void> => {
  const params = ReviewTimeOffRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ReviewTimeOffRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [request] = await db
    .update(timeOffRequestsTable)
    .set({
      status: parsed.data.status,
      reviewedBy: parsed.data.reviewedBy,
      reviewedAt: new Date(),
      notes: parsed.data.notes ?? undefined,
    })
    .where(eq(timeOffRequestsTable.id, params.data.id))
    .returning();

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, request.employeeId));
  let reviewedByName: string | null = null;
  if (request.reviewedBy) {
    const [reviewer] = await db.select().from(employeesTable).where(eq(employeesTable.id, request.reviewedBy));
    reviewedByName = reviewer?.name ?? null;
  }

  res.json(formatRequest(request, employee?.name ?? null, reviewedByName));
});

export default router;
