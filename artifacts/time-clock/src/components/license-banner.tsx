import { AlertTriangle, XCircle, Info } from "lucide-react";
import { useLicense } from "@/contexts/license-context";

export function LicenseBanner() {
  const { tier, daysRemaining, expiresAt, maxEmployees } = useLicense();

  if (tier === "valid") return null;

  const expiredDays = daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : null;
  const expiresSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 14;
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;

  if (tier === "trial") {
    const isNearExpiry = daysRemaining !== null && daysRemaining <= 7;
    const BannerIcon = isNearExpiry ? AlertTriangle : Info;
    const colors = isNearExpiry
      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
      : "bg-blue-50 border-blue-200 text-blue-800";

    return (
      <div className={`${colors} border-b px-4 py-2 flex items-center gap-2 text-sm`}>
        <BannerIcon className="h-4 w-4 shrink-0" />
        <span>
          <strong>Trial mode</strong>
          {daysRemaining !== null
            ? <> — <strong>{daysRemaining} {daysRemaining === 1 ? "day" : "days"}</strong> remaining{expiryDate && ` (expires ${expiryDate})`}</>
            : null
          }
          {maxEmployees !== null && <> · Limited to <strong>{maxEmployees} employees</strong></>}.{" "}
          Enter a <code className="bg-black/5 px-1 rounded text-xs">LICENSE_KEY</code> to unlock full access.
        </span>
      </div>
    );
  }

  if (tier === "trial_expired") {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-sm text-red-800">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Trial expired.</strong>{" "}
          Your 30-day trial has ended. Enter a license key to continue using TimeClock.
        </span>
      </div>
    );
  }

  if (tier === "expiring" && expiresSoon) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>License expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}</strong>
          {expiryDate && ` (${expiryDate})`}. Renew your subscription to avoid interruption.
        </span>
      </div>
    );
  }

  if (tier === "grace") {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2 text-sm text-orange-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>License expired {expiredDays} {expiredDays === 1 ? "day" : "days"} ago.</strong>{" "}
          All features are still available. Renew now to avoid losing access.
        </span>
      </div>
    );
  }

  if (tier === "limited") {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-sm text-red-800">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>License expired {expiredDays} days ago.</strong>{" "}
          Reports, employee management, and admin features have been disabled. Renew to restore full access.
        </span>
      </div>
    );
  }

  if (tier === "minimal") {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-sm text-red-800">
        <XCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>License expired {expiredDays} days ago.</strong>{" "}
          Only clock in/out is available. Renew immediately to restore access.
        </span>
      </div>
    );
  }

  return null;
}
