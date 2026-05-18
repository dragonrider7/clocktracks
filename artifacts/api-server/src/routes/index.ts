import { Router, type IRouter } from "express";
import healthRouter from "./health";
import employeesRouter from "./employees";
import timeEntriesRouter from "./timeEntries";
import timeOffRequestsRouter from "./timeOffRequests";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(employeesRouter);
router.use(timeEntriesRouter);
router.use(timeOffRequestsRouter);
router.use(dashboardRouter);

export default router;
