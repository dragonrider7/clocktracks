import { Router, type IRouter } from "express";
import { checkLicense } from "../lib/license";

const router: IRouter = Router();

router.get("/license", (_req, res): void => {
  const status = checkLicense();
  res.json(status);
});

export default router;
