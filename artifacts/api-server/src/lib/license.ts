import { verify } from "crypto";

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAL62ResuY59FVB08HJK/NhhsCHS7Gijki/Tu0ABZpe6g=
-----END PUBLIC KEY-----`;

export type LicenseTier =
  | "valid"      // >14 days remaining — full access, no banner
  | "expiring"   // ≤14 days remaining — yellow banner
  | "grace"      // expired 1–30 days — orange banner, all features
  | "limited"    // expired 31–90 days — red banner, reports/employees/admin off
  | "minimal"    // expired 91–180 days — red banner, clock only
  | "locked"     // expired 180+ days — full lockout
  | "trial";     // no key configured — banner, full access

export interface LicenseStatus {
  tier: LicenseTier;
  customer: string | null;
  email: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  valid: boolean;
}

export function checkLicense(): LicenseStatus {
  const raw = process.env.LICENSE_KEY;

  if (!raw || !raw.trim()) {
    return { tier: "trial", customer: null, email: null, expiresAt: null, daysRemaining: null, valid: false };
  }

  try {
    const key = raw.trim();
    if (!key.startsWith("TC-")) throw new Error("Invalid prefix");

    const withoutPrefix = key.slice(3);
    const dotIndex = withoutPrefix.lastIndexOf(".");
    if (dotIndex === -1) throw new Error("Invalid format");

    const payloadB64 = withoutPrefix.slice(0, dotIndex);
    const sigHex = withoutPrefix.slice(dotIndex + 1);

    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");

    const sigBuffer = Buffer.from(sigHex, "hex");
    const isValid = verify(null, Buffer.from(payloadStr), PUBLIC_KEY, sigBuffer);

    if (!isValid) throw new Error("Invalid signature");

    const payload = JSON.parse(payloadStr) as {
      v: number;
      sub: string;
      email?: string;
      exp: number;
      iat: number;
    };

    const now = Date.now();
    const expMs = payload.exp * 1000;
    const daysRemaining = Math.floor((expMs - now) / 86400000);
    const expiresAt = new Date(expMs).toISOString();

    let tier: LicenseTier;
    if (daysRemaining > 14) tier = "valid";
    else if (daysRemaining > 0) tier = "expiring";
    else if (daysRemaining >= -30) tier = "grace";
    else if (daysRemaining >= -90) tier = "limited";
    else if (daysRemaining >= -180) tier = "minimal";
    else tier = "locked";

    return {
      tier,
      customer: payload.sub,
      email: payload.email ?? null,
      expiresAt,
      daysRemaining,
      valid: daysRemaining > 0,
    };
  } catch {
    return { tier: "locked", customer: null, email: null, expiresAt: null, daysRemaining: null, valid: false };
  }
}
