import { useGetDashboardStatus, useGetWeeklyHours, useGetPendingRequests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Clock, CalendarIcon, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: status, isLoading: statusLoading } = useGetDashboardStatus();
  const { data: weeklyHours, isLoading: hoursLoading } = useGetWeeklyHours();
  const { data: pendingRequests, isLoading: pendingLoading } = useGetPendingRequests();

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
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground mt-1">All systems operational</p>
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
    </div>
  );
}
