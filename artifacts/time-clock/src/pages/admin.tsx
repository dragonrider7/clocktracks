import { useLocation, Redirect } from "wouter";
import { useMe } from "@/contexts/me-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useListTimeAdjustments,
  useGetPendingRequests,
  useGetUnreadNotificationCount,
  getListTimeAdjustmentsQueryKey,
  getGetUnreadNotificationCountQueryKey,
} from "@workspace/api-client-react";
import {
  Users, Calendar, FileBarChart, Gift, Settings,
  ClipboardList, Eye, EyeOff, Bell, Clock, CheckCircle,
} from "lucide-react";

export default function Admin() {
  const { me, isAdmin, isViewingAsEmployee, setIsViewingAsEmployee } = useMe();
  const [, setLocation] = useLocation();
  const isActualAdmin = me?.role === "admin";

  if (!isActualAdmin) return <Redirect to="/dashboard" />;

  const adjustParams = { status: "pending" };
  const { data: pendingAdjustments } = useListTimeAdjustments(adjustParams, {
    query: { queryKey: getListTimeAdjustmentsQueryKey(adjustParams) },
  });
  const { data: pendingTimeOff } = useGetPendingRequests();
  const countParams = me ? { employeeId: me.id } : { employeeId: 0 };
  const { data: notifCount } = useGetUnreadNotificationCount(countParams, {
    query: {
      enabled: !!me,
      queryKey: getGetUnreadNotificationCountQueryKey(countParams),
      refetchInterval: 30000,
    },
  });

  const pendingAdj = pendingAdjustments?.length ?? 0;
  const pendingOff = pendingTimeOff?.count ?? 0;
  const unreadNotifs = notifCount?.count ?? 0;

  const adminLinks = [
    { href: "/employees", icon: Users, label: "Manage Employees", desc: "Add, edit, or remove team members" },
    { href: "/time-entries", icon: Clock, label: "Time Log", desc: "View and edit all time entries" },
    { href: "/time-adjustments", icon: ClipboardList, label: "Adjustment Requests", desc: "Review employee time correction requests", badge: pendingAdj },
    { href: "/time-off", icon: Calendar, label: "Time Off Requests", desc: "Approve or deny time off requests", badge: pendingOff },
    { href: "/holidays", icon: Gift, label: "Holidays", desc: "Manage company holidays" },
    { href: "/reports", icon: FileBarChart, label: "Reports", desc: "Timesheets and time off balances" },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your team and review requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadNotifs > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <Bell className="h-4 w-4" />
              <span className="font-medium">{unreadNotifs} unread</span>
            </div>
          )}
          <Button
            variant={isViewingAsEmployee ? "default" : "outline"}
            onClick={() => setIsViewingAsEmployee(!isViewingAsEmployee)}
            className={`gap-2 ${isViewingAsEmployee ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`}
          >
            {isViewingAsEmployee ? (
              <>
                <Eye className="h-4 w-4" />
                Exit Employee View
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Preview as Employee
              </>
            )}
          </Button>
        </div>
      </div>

      {isViewingAsEmployee && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <EyeOff className="h-4 w-4 shrink-0" />
          <span>You are currently previewing the site as a regular employee. Admin features are hidden across all pages.</span>
        </div>
      )}

      {(pendingAdj > 0 || pendingOff > 0) && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap gap-6">
              {pendingOff > 0 && (
                <button
                  onClick={() => setLocation("/time-off")}
                  className="flex items-center gap-2 text-amber-800 hover:text-amber-900 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">{pendingOff} pending time off {pendingOff === 1 ? "request" : "requests"}</span>
                </button>
              )}
              {pendingAdj > 0 && (
                <button
                  onClick={() => setLocation("/time-adjustments")}
                  className="flex items-center gap-2 text-amber-800 hover:text-amber-900 transition-colors"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="text-sm font-medium">{pendingAdj} pending time {pendingAdj === 1 ? "adjustment" : "adjustments"}</span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingAdj === 0 && pendingOff === 0 && (
        <Card className="border-green-200 bg-green-50/60">
          <CardContent className="py-3 px-5 flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="h-4 w-4" />
            <span>All caught up — no pending requests.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {adminLinks.map(({ href, icon: Icon, label, desc, badge }) => (
          <button
            key={href}
            onClick={() => setLocation(href)}
            className="text-left group"
          >
            <Card className="h-full hover:shadow-md transition-all hover:border-primary/30 group-hover:bg-muted/30">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5 border border-amber-200 font-medium">
                        {badge} pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
