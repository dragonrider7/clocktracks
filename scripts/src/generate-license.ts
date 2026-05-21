/**
 * TimeClock License Key Generator
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run generate-license
 *
 * Reads private-key.pem from scripts/ directory (keep this secret, never share it).
 * Outputs a license key you can send to the customer to put in their .env.docker.
 */
import { sign } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIVATE_KEY_PATH = join(__dirname, "..", "private-key.pem");

function generateLicense(customer: string, email: string, daysValid = 365): string {
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

  const payload = JSON.stringify({ v: 1, sub: customer, email, exp, iat: now });
  const payloadB64 = Buffer.from(payload).toString("base64url");

  const sig = sign(null, Buffer.from(payload), privateKey).toString("hex");

  return `TC-${payloadB64}.${sig}`;
}

// ── Read args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const customer = args[0];
const email = args[1];
const days = args[2] ? parseInt(args[2]) : 365;

if (!customer || !email) {
  console.log(`
Usage:
  pnpm --filter @workspace/scripts run generate-license <CustomerName> <email> [days]

Examples:
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com
  pnpm --filter @workspace/scripts run generate-license "Acme Corp" admin@acmecorp.com 365
`);
  process.exit(1);
}

const key = generateLicense(customer, email, days);
const expiresAt = new Date(Date.now() + days * 86400000).toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

console.log(`
Customer : ${customer}
Email    : ${email}
Valid for: ${days} days (expires ${expiresAt})

LICENSE KEY — put this in .env.docker as LICENSE_KEY=
─────────────────────────────────────────────────────
${key}
─────────────────────────────────────────────────────
`);
