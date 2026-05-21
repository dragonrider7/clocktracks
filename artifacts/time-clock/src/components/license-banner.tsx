import { AlertTriangle, XCircle, Info } from "lucide-react";
import { useLicense } from "@/contexts/license-context";

export function LicenseBanner() {
  const { tier, daysRemaining, expiresAt } = useLicense();

  if (tier === "valid") return null;

  const expiredDays = daysRemaining !== null && daysRemaining < 0 ? Math.abs(daysRemaining) : null;
  const expiresSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 14;
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;

  if (tier === "trial") {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          <strong>Trial mode</strong> — No license key configured. Add a{" "}
          <code className="bg-blue-100 px-1 rounded text-xs">LICENSE_KEY</code> to your{" "}
          <code className="bg-blue-100 px-1 rounded text-xs">.env.docker</code> to activate.
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
