import { useUser, UserProfile } from "@clerk/react";
import { useMe } from "@/contexts/me-context";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { useGetTimeOffBalances } from "@workspace/api-client-react";
import { Mail, Building2, ShieldCheck, Clock4, Umbrella } from "lucide-react";

function fmtHours(h: number) {
  return h === Math.floor(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export default function Profile() {
  const { me, isAdmin } = useMe();
  const { user } = useUser();

  const { data: balances } = useGetTimeOffBalances(
    me ? { employeeId: me.id } : {},
    { query: { enabled: !!me, queryKey: ["profile-balance", me?.id] } }
  );
  const balance = balances?.[0];

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Employee summary card */}
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={me?.name ?? "Profile"}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/20"
                />
              ) : (
                <EmployeeAvatar name={me?.name ?? "?"} size="lg" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="text-xl font-bold truncate">{me?.name ?? "—"}</h2>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {me?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />{me.email}
                  </span>
                )}
                {me?.department && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />{me.department}
                  </span>
                )}
                <span className={`flex items-center gap-1.5 font-medium ${isAdmin ? "text-primary" : ""}`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isAdmin ? "Admin" : "Employee"}
                </span>
              </div>
            </div>

            {balance && (
              <div className="flex gap-4 text-center border-l pl-5">
                <div>
                  <div className="text-xl font-bold">{fmtHours(balance.allottedHours)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Umbrella className="h-3 w-3" />Allotted</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{fmtHours(balance.usedHours)}</div>
                  <div className="text-xs text-muted-foreground">Used</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-500">{fmtHours(balance.plannedHours)}</div>
                  <div className="text-xs text-muted-foreground">Planned</div>
                </div>
                <div>
                  <div className={`text-xl font-bold ${balance.usedPlusPlannedHours > balance.allottedHours ? "text-destructive" : "text-emerald-600"}`}>
                    {fmtHours(balance.remainingHours)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock4 className="h-3 w-3" />Remaining</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clerk profile - full account settings with profile picture */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Account Settings</h2>
          <p className="text-sm text-muted-foreground">
            Update your profile picture, display name, email addresses, and security settings.
          </p>
        </div>
        <div className="rounded-xl overflow-hidden border bg-card">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full max-w-full shadow-none rounded-none border-0",
                card: "!shadow-none !border-0 !rounded-none",
                navbar: "border-r",
                pageScrollBox: "p-6",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
