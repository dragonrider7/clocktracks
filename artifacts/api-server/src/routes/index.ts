import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import superAdminRouter from "./superAdmin";
import employeesRouter from "./employees";
import timeEntriesRouter from "./timeEntries";
import timeOffRequestsRouter from "./timeOffRequests";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import holidaysRouter from "./holidays";
import timeAdjustmentsRouter from "./timeAdjustments";
import notificationsRouter from "./notifications";
import licenseRouter from "./license";

const router: IRouter = Router();

router.use(licenseRouter);
router.use(healthRouter);
router.use(superAdminRouter);
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
