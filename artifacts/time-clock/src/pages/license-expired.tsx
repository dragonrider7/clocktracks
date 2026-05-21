import { XCircle } from "lucide-react";
import { useLicense } from "@/contexts/license-context";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LicenseExpired() {
  const { daysRemaining } = useLicense();
  const expiredDays = daysRemaining !== null ? Math.abs(daysRemaining) : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="TimeClock" className="h-10 w-10 opacity-40" />
          <span className="text-2xl font-bold text-muted-foreground">TimeClock</span>
        </div>
        <XCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">License Expired</h1>
        <p className="text-muted-foreground max-w-sm">
          {expiredDays !== null
            ? `Your license expired ${expiredDays} days ago.`
            : "Your license has expired."}
          {" "}This installation is no longer active.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/40 px-6 py-5 max-w-sm text-sm text-muted-foreground space-y-2 text-left">
        <p className="font-semibold text-foreground">To restore access:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Purchase or renew your annual license</li>
          <li>Add the new key to <code className="bg-muted px-1 rounded">.env.docker</code> as <code className="bg-muted px-1 rounded">LICENSE_KEY=</code></li>
          <li>Run <code className="bg-muted px-1 rounded">stop.bat</code> then <code className="bg-muted px-1 rounded">start.bat</code></li>
        </ol>
      </div>
    </div>
  );
}
