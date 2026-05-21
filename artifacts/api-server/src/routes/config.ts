import { Router, type IRouter } from "express";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();

/**
 * Public config endpoint — no auth required.
 * Exposes runtime Clerk configuration to the frontend so Docker customers
 * don't need to rebuild the image when they provide their own Clerk keys.
 */
router.get("/config", (req, res): void => {
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? null;

  // If CLERK_PROXY_URL is explicitly set, use it.
  // Otherwise, in production derive it from the request host so the proxy URL
  // is always correct for the domain the customer is actually running on.
  let clerkProxyUrl: string | null = process.env.CLERK_PROXY_URL ?? null;
  if (!clerkProxyUrl && process.env.NODE_ENV === "production") {
    const host = getClerkProxyHost(req);
    if (host) {
      const proto = req.headers["x-forwarded-proto"] ?? "https";
      clerkProxyUrl = `${proto}://${host}/api/__clerk`;
    }
  }

  res.json({ clerkPublishableKey, clerkProxyUrl });
});

export default router;
