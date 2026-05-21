import { Router, type IRouter } from "express";

const SUPER_ADMIN_USERNAME = "clocktracksadmin";
const SUPER_ADMIN_PASSWORD = "#sehVivrEwd$inet6rR9VzpawoBZ@u64";
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

const router: IRouter = Router();

router.post("/superadmin/login", (req, res): void => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
    // httpOnly signed cookie — the actual auth token
    res.cookie("_ctsa_s", "1", {
      httpOnly: true,
      signed: true,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    // Readable flag cookie — lets the frontend detect ghost mode without a round-trip
    res.cookie("_ctsa", "1", {
      httpOnly: false,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    res.json({ ok: true });
    return;
  }

  res.status(401).json({ error: "Invalid credentials" });
});

router.post("/superadmin/logout", (_req, res): void => {
  res.clearCookie("_ctsa_s", { path: "/" });
  res.clearCookie("_ctsa", { path: "/" });
  res.json({ ok: true });
});

export default router;
