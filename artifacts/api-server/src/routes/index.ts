import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import employeesRouter from "./employees";
import timeEntriesRouter from "./timeEntries";
import timeOffRequestsRouter from "./timeOffRequests";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import holidaysRouter from "./holidays";
import timeAdjustmentsRouter from "./timeAdjustments";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(employeesRouter);
router.use(timeEntriesRouter);
router.use(timeOffRequestsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(holidaysRouter);
router.use(timeAdjustmentsRouter);
router.use(notificationsRouter);

export default router;
