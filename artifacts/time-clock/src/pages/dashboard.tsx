import {
  useGetDashboardStatus,
  useGetWeeklyHours,
  useGetPendingRequests,
  useGetOutThisWeek,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CalendarIcon, Activity, Umbrella } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const typeColors: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-700",
  sick: "bg-red-100 text-red-700",
  personal: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

function fmtDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { data: status, isLoading: statusLoading } = useGetDashboardStatus();
  const { data: weeklyHours, isLoading: hoursLoading } = useGetWeeklyHours();
  const { data: pendingRequests, isLoading: pendingLoading } = useGetPendingRequests();
  const { data: outThisWeek, isLoading: outLoading } = useGetOutThisWeek();

  return (
    <div className="grid gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{status?.clockedInCount} / {status?.totalEmployees}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Employees currently working</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statusLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{status?.todayTotalHours?.toFixed(1) || "0.0"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total hours tracked today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Time Off</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pendingLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{pendingRequests?.count || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Requests waiting for approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out This Week</CardTitle>
            <Umbrella className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {outLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{outThisWeek?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Employees on approved time off</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Currently Clocked In</CardTitle>
            <CardDescription>Real-time view of active team members</CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                {status?.clockedInEmployees?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No one is currently clocked in.</div>
                ) : (
                  status?.clockedInEmployees?.map((emp) => (
                    <div key={emp.employeeId} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {emp.employeeName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{emp.employeeName}</p>
                          <p className="text-sm text-muted-foreground">{emp.department || "No Department"}</p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Since {new Date(emp.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Weekly Hours Summary</CardTitle>
            <CardDescription>Total hours worked this week</CardDescription>
          </CardHeader>
          <CardContent>
            {hoursLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                {weeklyHours?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No hours tracked this week.</div>
                ) : (
                  weeklyHours?.map((emp) => (
                    <div key={emp.employeeId} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium leading-none">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{emp.daysWorked} days worked</p>
                      </div>
                      <div className="font-medium">
                        {(emp.totalMinutes / 60).toFixed(1)} hrs
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Out This Week</CardTitle>
          <CardDescription>Employees on approved time off this week</CardDescription>
        </CardHeader>
        <CardContent>
          {outLoading ? <Skeleton className="h-24 w-full" /> : (
            outThisWeek?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No one is on approved time off this week.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {outThisWeek?.map((item) => (
                  <div key={item.requestId} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {item.employeeName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.employeeName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge className={`text-xs px-1.5 py-0 ${typeColors[item.type] ?? typeColors.other}`}>
                          {item.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDateShort(item.startDate)}
                          {item.startDate !== item.endDate && ` – ${fmtDateShort(item.endDate)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
