import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, Mail, Trash2, RefreshCw } from "lucide-react";
import { useUpdateLicenseKey, getGetLicenseStatusQueryKey } from "@workspace/api-client-react";
import { useLicense } from "@/contexts/license-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIER_CONFIG: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  icon: React.ElementType;
  description: string;
}> = {
  valid:         { label: "Active",         variant: "default",     className: "bg-green-100 text-green-800 border-green-300",   icon: CheckCircle2,   description: "Full access" },
  expiring:      { label: "Expiring Soon",  variant: "outline",     className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock,          description: "Renew soon" },
  grace:         { label: "Grace Period",   variant: "outline",     className: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertTriangle,  description: "Full access, renew now" },
  limited:       { label: "Limited Access", variant: "destructive", className: "bg-red-100 text-red-800 border-red-300",          icon: AlertTriangle,  description: "Some features disabled" },
  minimal:       { label: "Minimal Access", variant: "destructive", className: "bg-red-100 text-red-800 border-red-300",          icon: XCircle,        description: "Clock in/out only" },
  locked:        { label: "Locked",         variant: "destructive", className: "bg-red-100 text-red-800 border-red-300",          icon: XCircle,        description: "Access suspended" },
  trial:         { label: "Trial Mode",     variant: "secondary",   className: "bg-blue-100 text-blue-800 border-blue-300",       icon: Info,           description: "30-day trial · 5 employees" },
  trial_expired: { label: "Trial Expired",  variant: "destructive", className: "bg-red-100 text-red-800 border-red-300",          icon: XCircle,        description: "Enter a key to continue" },
};

export function LicenseDialog({ open, onOpenChange }: LicenseDialogProps) {
  const license = useLicense();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [keyInput, setKeyInput] = useState("");

  const { mutate: updateKey, isPending } = useUpdateLicenseKey({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLicenseStatusQueryKey(), data);
        queryClient.invalidateQueries({ queryKey: getGetLicenseStatusQueryKey() });
        setKeyInput("");
        toast({ title: "License updated", description: `Status: ${TIER_CONFIG[data.tier]?.label ?? data.tier}` });
      },
      onError: () => {
        toast({ title: "Failed to update license", description: "Check the key and try again.", variant: "destructive" });
      },
    },
  });

  const config = TIER_CONFIG[license.tier] ?? TIER_CONFIG.trial;
  const StatusIcon = config.icon;
  const hasKey = license.tier !== "trial" && license.tier !== "trial_expired";
  const daysLeft = license.daysRemaining;
  const expiredDays = daysLeft !== null && daysLeft < 0 ? Math.abs(daysLeft) : null;

  const renewalSubject = encodeURIComponent("ClockTracks License Renewal");
  const renewalBody = encodeURIComponent(
    `Hello,\n\nI would like to renew my ClockTracks annual license.\n\nCustomer: ${license.customer ?? "—"}\nEmail: ${license.email ?? "—"}\n\nPlease send me a new license key.\n\nThank you`
  );
  const renewalHref = `mailto:support@clocktracks.com?subject=${renewalSubject}&body=${renewalBody}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>License</DialogTitle>
          <DialogDescription>
            Manage your ClockTracks annual subscription license.
          </DialogDescription>
        </DialogHeader>

        {/* ── Status card ───────────────────────────────────────────────── */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Status</span>
            <Badge className={`${config.className} border gap-1.5 font-medium`} variant="outline">
              <StatusIcon className="h-3.5 w-3.5" />
              {config.label}
            </Badge>
          </div>

          {hasKey && license.customer && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Licensed to</span>
              <span className="text-sm font-medium">{license.customer}</span>
            </div>
          )}

          {hasKey && license.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Expiry date</span>
              <span className="text-sm font-medium">
                {new Date(license.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          )}

          {hasKey && daysLeft !== null && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Time remaining</span>
              <span className={`text-sm font-semibold ${daysLeft > 14 ? "text-green-700" : daysLeft > 0 ? "text-yellow-700" : "text-red-700"}`}>
                {daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                  : expiredDays !== null
                    ? `Expired ${expiredDays} day${expiredDays === 1 ? "" : "s"} ago`
                    : "Expired"}
              </span>
            </div>
          )}

          {!hasKey && license.tier === "trial" && (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>No license key is active.</p>
              <ul className="space-y-1 text-xs">
                <li>• <span className="font-medium text-foreground">Employee limit:</span> up to 5 employees</li>
                {daysLeft !== null && (
                  <li>• <span className="font-medium text-foreground">Trial ends:</span>{" "}
                    {daysLeft > 0
                      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`
                      : "today"
                    }
                    {license.expiresAt && ` (${new Date(license.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })})`}
                  </li>
                )}
              </ul>
            </div>
          )}
          {!hasKey && license.tier === "trial_expired" && (
            <p className="text-sm text-destructive font-medium">
              Your 30-day trial has expired. Enter a license key below to restore access.
            </p>
          )}
        </div>

        {/* ── Renewal link ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Need a key?</p>
            <p className="text-xs text-muted-foreground">Purchase or renew your annual subscription.</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={renewalHref}>
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Request Renewal
            </a>
          </Button>
        </div>

        <Separator />

        {/* ── Update key ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {hasKey ? "Replace license key" : "Enter license key"}
          </label>
          <Textarea
            placeholder="TC-eyJ2Ijox..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="font-mono text-xs h-20 resize-none"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => updateKey({ data: { key: keyInput.trim() || null } })}
              disabled={isPending || !keyInput.trim()}
            >
              {isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Activating…</>
              ) : (
                "Activate Key"
              )}
            </Button>
            {hasKey && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Remove the current license key? The app will revert to trial mode.")) {
                    updateKey({ data: { key: null } });
                  }
                }}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
