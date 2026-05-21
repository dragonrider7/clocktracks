/**
 * TimeClock License Key Generator
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run generate-license
 *
 * Reads private-key.pem from scripts/ directory (keep this secret, never share it).
 * Outputs a license key you can send to the customer to put in their .env.docker.
 *
 * Tiers (maxEmployees):
 *   small   →  15  employees  ($49/mo)
 *   medium  →  50  employees  ($99/mo)
 *   large   → 100  employees  ($149/mo)
 *   enterprise → unlimited   (custom)
 */
import { sign } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY_PATH = join(__dirname, "..", "private-key.pem");

const TIER_MAP: Record<string, number | null> = {
  small: 15,
  medium: 50,
  large: 100,
  enterprise: null,
};

function tierLabel(maxEmployees: number | null): string {
  if (maxEmployees === null) return "Enterprise (unlimited employees)";
  if (maxEmployees <= 15) return `Small Team (up to ${maxEmployees} employees) — $49/mo`;
  if (maxEmployees <= 50) return `Medium Business (up to ${maxEmployees} employees) — $99/mo`;
  if (maxEmployees <= 100) return `Large Business (up to ${maxEmployees} employees) — $149/mo`;
  return `Up to ${maxEmployees} employees`;
}

function generateLicense(
  customer: string,
  email: string,
  daysValid = 365,
  maxEmployees: number | null = null,
): string {
  let privateKey: string;
  try {
    privateKey = readFileSync(PRIVATE_KEY_PATH, "utf8");
  } catch {
    console.error(`\nERROR: Could not read private key from:\n  ${PRIVATE_KEY_PATH}`);
    console.error("Make sure private-key.pem exists in the scripts/ folder.\n");
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + daysValid * 86400;

  const payloadObj: Record<string, unknown> = { v: 1, sub: customer, email, exp, iat: now };
  if (maxEmployees !== null) payloadObj.maxEmployees = maxEmployees;

  const payload = JSON.stringify(payloadObj);
  const payloadB64 = Buffer.from(payload).toString("base64url");

  const sig = sign(null, Buffer.from(payload), privateKey).toString("hex");

  return `TC-${payloadB64}.${sig}`;
}

// ── Read args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const customer = args[0];
const email = args[1];
const days = args[2] ? parseInt(args[2]) : 365;
const tierArg = args[3]?.toLowerCase();

if (!customer || !email) {
  console.log(`
Usage:
  pnpm --filter @workspace/scripts run generate-license <CustomerName> <email> [days] [tier]

Tiers:
  small      →  up to 15 employees  ($49/mo)
  medium     →  up to 50 employees  ($99/mo)
  large      →  up to 100 employees ($149/mo)
  enterprise →  unlimited           (custom pricing)
  <number>   →  exact employee cap  (e.g. 25)

Examples:
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com 365 small
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com 365 medium
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com 365 large
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com 365 enterprise
`);
  process.exit(1);
}

let maxEmployees: number | null = null;
if (tierArg) {
  if (tierArg in TIER_MAP) {
    maxEmployees = TIER_MAP[tierArg]!;
  } else {
    const n = parseInt(tierArg);
    if (!isNaN(n) && n > 0) {
      maxEmployees = n;
    } else {
      console.error(`\nUnknown tier: "${tierArg}". Use small, medium, large, enterprise, or a number.\n`);
      process.exit(1);
    }
  }
}

const key = generateLicense(customer, email, days, maxEmployees);
const expiresAt = new Date(Date.now() + days * 86400000).toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

console.log(`
Customer : ${customer}
Email    : ${email}
Valid for: ${days} days (expires ${expiresAt})
Tier     : ${tierLabel(maxEmployees)}

LICENSE KEY — put this in .env.docker as LICENSE_KEY=
─────────────────────────────────────────────────────
${key}
─────────────────────────────────────────────────────
`);
